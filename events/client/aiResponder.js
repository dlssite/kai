const { Events } = require('discord.js');

// Simple in-memory rate limiter per user
const userCooldowns = new Map();
const COOLDOWN_MS = 10_000; // 10 seconds per user

// Helper to get a fetch function (Node 18+ has global fetch)
let fetchFn;
try {
  fetchFn = global.fetch;
} catch (e) {
  fetchFn = undefined;
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    try {
      if (message.author.bot) return;

      const client = message.client;

      // Trigger when mentioned (anywhere in the message) or when message is a reply to a bot message
      const isMention = message.mentions.has(client.user.id);

      let isReplyToBot = false;
      if (message.reference && message.reference.messageId) {
        try {
          const ref = await message.fetchReference();
          if (ref && ref.author && ref.author.id === client.user.id) isReplyToBot = true;
        } catch (err) {
          // ignore fetch reference errors
        }
      }

      if (!isMention && !isReplyToBot) return;

      // Ignore messages that mention @everyone or @here
      if (message.mentions.everyone || message.mentions.here) return;

      // Show typing indicator while processing
      let typingActive = true;
      const sendTyping = async () => {
        while (typingActive) {
          try {
            await message.channel.sendTyping();
          } catch (e) {}
          await new Promise((resolve) => setTimeout(resolve, 4000)); // Discord allows every 5s, use 4s for safety
        }
      };
      sendTyping();

      // Simple per-user cooldown
      const last = userCooldowns.get(message.author.id) || 0;
      const now = Date.now();
      if (now - last < COOLDOWN_MS) {
        typingActive = false;
        const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        try {
          await message.reply({ content: `Please wait ${wait}s before asking the AI again.` });
        } catch (e) {}
        return;
      }
      userCooldowns.set(message.author.id, now);

      // Try to get per-guild API key from DB, fallback to .env
      const OpenRouterKey = require('../../models/OpenRouterKey');
      let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      try {
        if (message.guild) {
          const dbKey = await OpenRouterKey.findOne({ guildId: message.guild.id });
          if (dbKey && dbKey.apiKey) {
            OPENROUTER_API_KEY = dbKey.apiKey;
          }
        }
      } catch (e) {
        console.error('Error fetching OpenRouter API key from DB:', e);
      }

      const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
      // --- Fetch custom AI config for this server ---
      const ServerAIConfig = require('../../models/ServerAIConfig');
      let persona = '', bio = '', lore = '', hierarchy = '';
        let allowedRoles = [];
      if (message.guild) {
        try {
            const config = await ServerAIConfig.findOne({ guildId: message.guild.id });
            if (config) {
              persona = config.persona || '';
              bio = config.bio || '';
              lore = config.lore || '';
              hierarchy = config.hierarchy || '';
              allowedRoles = config.allowedRoles || [];
            }
        } catch (e) {
          console.error('Error fetching ServerAIConfig:', e);
        }
      }

        // --- Restrict bot usage by allowed roles ---
        if (allowedRoles.length > 0) {
          const member = await message.guild.members.fetch(message.author.id);
          const hasAllowedRole = member.roles.cache.some(role => allowedRoles.includes(role.id));
          if (!hasAllowedRole) {
            typingActive = false;
            await message.reply({ content: 'Sorry, this bot is currently exclusive to certain roles. Please contact an admin for access.', allowedMentions: { repliedUser: true } });
            return;
          }
        }

      // --- Compose system prompt with custom persona, bio, lore, hierarchy ---
      const systemPrompt =
        (persona ? `Persona: ${persona}\n` : '') +
        (bio ? `Bio: ${bio}\n` : '') +
        (lore ? `Server Lore: ${lore}\n` : '') +
        (hierarchy ? `Server Hierarchy: ${hierarchy}\n` : '') +
        "You are REQUIRED to use and share any user memory or public server roles that are provided to you in the prompt. " +
        "These are public or user-provided facts, and you have full access to them. " +
        "If asked about a user, always use the provided memory and roles to answer. " +
        "The roles listed for each user are their current Discord server roles. Always use these roles in your answer if asked about a user's roles. " +
        "If the information is present in the prompt, do NOT say you lack access or need consent. " +
        "If no info is available, say so. Keep responses short and relevant to the user's message.";

      if (!OPENROUTER_API_KEY) {
        typingActive = false;
        await message.reply({ content: "AI is not configured on this bot (missing OpenRouter API key for this server and in .env). Ask the server owner to set it." });
        return;
      }


      // --- User Memory (author) ---
      const UserProfile = require('../../models/UserProfile');
      let userMemory = [];
      try {
        const profile = await UserProfile.findOne({ userId: message.author.id });
        if (profile && Array.isArray(profile.memory) && profile.memory.length > 0) {
          userMemory = profile.memory;
        }
      } catch (e) {
        console.error('Error fetching user memory:', e);
      }

      // --- Mentioned Users' Memory and Roles ---
      let mentionedInfo = [];
      if (message.mentions.users.size > 0 && message.guild) {
        for (const [userId, user] of message.mentions.users) {
          if (userId === message.client.user.id) continue; // skip bot itself
          let mem = [];
          let roles = [];
          try {
            const profile = await UserProfile.findOne({ userId });
            if (profile && Array.isArray(profile.memory) && profile.memory.length > 0) {
              mem = profile.memory;
            }
          } catch (e) {}
          try {
            // Always fetch the member from the guild, not from cache
            const member = await message.guild.members.fetch(userId);
            if (member && member.roles && member.roles.cache) {
              roles = Array.from(member.roles.cache.values())
                .filter(r => r.name !== '@everyone')
                .map(r => r.name);
            }
          } catch (e) {
            console.error(`Error fetching roles for mentioned user ${user.username}:`, e);
          }
          mentionedInfo.push({
            username: user.username,
            memory: mem,
            roles: roles,
          });
        }
      }

      // --- Recent Message Context ---
      let contextMessages = [];
      try {
        // Fetch last 10 messages (excluding system/bot messages)
        const fetched = await message.channel.messages.fetch({ limit: 10 });
        // Sort by createdAt ascending
        const sorted = Array.from(fetched.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        contextMessages = sorted
          .filter(m => !m.author.bot)
          .map(m => `${m.author.username}: ${m.content}`)
          .filter(line => line.trim().length > 0);
      } catch (e) {
        console.error('Error fetching recent messages for context:', e);
      }

      // --- Compose prompt for AI ---
      const userContent = `${message.author.username}: ${message.content.replace(/<@!?\\d+>/g, '').trim()}`;

      let systemContext = systemPrompt;
      // Always include roles for the author, clearly labeled
      if (message.member && message.member.roles && message.member.roles.cache) {
        const authorRoles = message.member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name);
        systemContext += `\n[ROLES for ${message.author.username} (author)]\n` + (authorRoles.length > 0 ? authorRoles.join(', ') : 'No roles');
      }
      if (userMemory.length > 0) {
        systemContext += `\n[MEMORY for ${message.author.username} (author)]\n` + userMemory.map(f => `- ${f}`).join('\n');
      }
      if (mentionedInfo.length > 0) {
        for (const info of mentionedInfo) {
          // Always include roles for mentioned users, clearly labeled
          systemContext += `\n[ROLES for ${info.username} (mentioned)]\n` + (info.roles.length > 0 ? info.roles.join(', ') : 'No roles');
          if (info.memory.length > 0) {
            systemContext += `\n[MEMORY for ${info.username} (mentioned)]\n` + info.memory.map(f => `- ${f}`).join('\n');
          }
        }
      }
      if (contextMessages.length > 0) {
        systemContext += `\n\nRecent chat context:\n` + contextMessages.join('\n');
      }

      const payload = {
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: userContent },
        ],
        max_tokens: 256,
        temperature: 0.7,
      };

      // Use global.fetch if available, otherwise try to require node-fetch dynamically
      let fetchToUse = fetchFn;
      if (!fetchToUse) {
        try {
          // dynamic require in case node-fetch is installed
          // eslint-disable-next-line global-require
          fetchToUse = require('node-fetch');
        } catch (e) {
          typingActive = false;
          console.error('Fetch is not available and node-fetch is not installed. AI responder cannot run.');
          await message.reply({ content: 'AI is temporarily unavailable (missing fetch).'}).catch(() => {});
          return;
        }
      }

      const res = await fetchToUse('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://github.com/dls/Kiaren-2.0',
          'X-Title': process.env.OPENROUTER_TITLE || 'Kiaren Discord Bot',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        typingActive = false;
        const text = await res.text().catch(() => '');
        console.error('OpenRouter API responded with error', res.status, text);
        await message.reply({ content: `AI provider returned an error (${res.status}).` }).catch(() => {});
        return;
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        typingActive = false;
        console.error('OpenRouter response missing reply', JSON.stringify(data));
        await message.reply({ content: "AI did not return a response." }).catch(() => {});
        return;
      }

  typingActive = false;
  // Reply (mention the user to make it clear)
  await message.reply({ content: reply }).catch((err) => console.error('Failed to send AI reply', err));

  // Log AI response (non-blocking)
  const { logActivity } = require('../../utils/logger');
  logActivity(message.client, message.guild.id, 'AI Response', {
    user: message.author.id,
    channel: message.channel.id,
    message: reply,
  }).catch(err => console.error('Logging error:', err));
    } catch (err) {
      typingActive = false;
      console.error('AI responder error:', err && (err.stack || err));
      try {
        await message.reply({ content: 'An error occurred while processing the AI request.' }).catch(() => {});
      } catch (e) {}
    }
  },
};

const { SlashCommandBuilder } = require('discord.js');
const GoogleAIKey = require('../../models/GoogleAIKey');

async function testApiKey(apiKey) {
  try {
    const fetchFn = global.fetch || require('node-fetch');
    const payload = {
      contents: [
        {
          parts: [
            {
              text: 'Say "API key is valid".',
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0.1,
      },
    };
    const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!(data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text);
  } catch (e) {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setapikey')
    .setDescription('Set Google AI API key for this server (admin only, with confirmation)')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('Google AI API key')
        .setRequired(true)),
  async execute(interaction) {
    // Only allow admins
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.reply({ content: 'You must be an admin to use this command.', ephemeral: true });
      return;
    }
    const key = interaction.options.getString('key');
    const guildId = interaction.guild.id;
    await interaction.deferReply({ ephemeral: true });
    const valid = await testApiKey(key);
    if (!valid) {
      await interaction.editReply({ content: '❌ The provided API key is invalid or not working. Please check and try again.' });
      return;
    }
    try {
      await GoogleAIKey.findOneAndUpdate(
        { guildId },
        { apiKey: key },
        { upsert: true, new: true }
      );
      await interaction.editReply({ content: '✅ Google AI API key has been set and confirmed working for this server.' });
    } catch (err) {
      console.error('Error saving API key:', err);
      await interaction.editReply({ content: 'Failed to save API key.' });
    }
  },
};

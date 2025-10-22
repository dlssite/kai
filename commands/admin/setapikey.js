const { SlashCommandBuilder } = require('discord.js');
const OpenRouterKey = require('../../models/OpenRouterKey');

async function testApiKey(apiKey) {
  try {
    const fetchFn = global.fetch || require('node-fetch');
    const payload = {
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Test if API key works.' },
        { role: 'user', content: 'Say "API key is valid".' },
      ],
      max_tokens: 10,
      temperature: 0.1,
    };
    const res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': 'https://github.com/gaurav87565/Kiaren-2.0',
  'X-Title': 'Kiaren Discord Bot',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
  } catch (e) {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setapikey')
    .setDescription('Set OpenRouter API key for this server (admin only, with confirmation)')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('OpenRouter API key')
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
      await OpenRouterKey.findOneAndUpdate(
        { guildId },
        { apiKey: key },
        { upsert: true, new: true }
      );
      await interaction.editReply({ content: '✅ OpenRouter API key has been set and confirmed working for this server.' });
    } catch (err) {
      console.error('Error saving API key:', err);
      await interaction.editReply({ content: 'Failed to save API key.' });
    }
  },
};

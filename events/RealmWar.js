const { Events, EmbedBuilder } = require('discord.js');
const WorldWar = require('../models/WorldWar');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    if (customId.startsWith('realmwar-join-')) {
      await interaction.deferReply({ ephemeral: true });
      const warNumber = parseInt(customId.split('-')[2], 10);
      const userId = interaction.user.id;

      const activeGame = await WorldWar.findOne({
        warNumber,
        status: 'active',
      });

      if (!activeGame) {
        return interaction.editReply({
          content: 'No active RealmWar game found.',
        });
      }

      if (activeGame.participants.includes(userId)) {
        return interaction.editReply({
          content: 'You are already in the game.',
        });
      }

      if (activeGame.participants.length >= activeGame.maxParticipants) {
        return interaction.editReply({
          content: 'The game is full.',
        });
      }

      activeGame.participants.push(userId);
      await activeGame.save();

      // Update the embed with new participant count
      const channel = interaction.channel;
      const message = await channel.messages.fetch(activeGame.messageId);
      const embed = message.embeds[0];
      const newEmbed = new EmbedBuilder(embed).setDescription(
        embed.description.replace(
          /• Current Champions: \d+/,
          `• Current Champions: ${activeGame.participants.length}`
        )
      );
      await message.edit({ embeds: [newEmbed] });

      interaction.editReply({
        content: 'You have successfully joined the RealmWar!',
      });
    }
  },
};

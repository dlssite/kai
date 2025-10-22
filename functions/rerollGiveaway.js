const { EmbedBuilder, MessageFlags } = require('discord.js');
const Giveaway = require('../models/Giveaway');

async function rerollGiveaway(interaction) {
  try {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const messageId = interaction.options.getString('message_id');
    const giveaway = await Giveaway.findOne({ messageId, ongoing: false });

    if (!giveaway) {
      return interaction.reply({
        content: 'Giveaway not found or is still ongoing.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check if user has permission to manage messages
    const channel = await interaction.guild.channels
      .fetch(giveaway.channelId)
      .catch(() => null);
    if (!channel) {
      return interaction.reply({
        content: 'Could not find the giveaway channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel.permissionsFor(interaction.member).has(['ManageMessages'])) {
      return interaction.reply({
        content: 'You need `ManageMessages` permission to reroll a giveaway!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (giveaway.participants.length < giveaway.winners) {
      return interaction.reply({
        content: 'Not enough participants to reroll.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check channel permissions
    if (
      !channel
        .permissionsFor(interaction.guild.members.me)
        .has(['SendMessages', 'EmbedLinks'])
    ) {
      return interaction.reply({
        content:
          'I need `SendMessages` and `EmbedLinks` permissions in the giveaway channel!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Get the message
    const message = await channel.messages
      .fetch(giveaway.messageId)
      .catch(() => null);
    if (!message) {
      return interaction.reply({
        content: 'Could not find the giveaway message.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Select new winners without duplicates
    const winners = [];
    const participants = [...giveaway.participants]; // Create a copy to avoid modifying the original array

    while (winners.length < giveaway.winners && participants.length > 0) {
      const randomIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants.splice(randomIndex, 1)[0]);
    }

    // Update the original message
    let embed = message.embeds[0];
    if (embed) {
      embed = EmbedBuilder.from(embed);
      embed.setDescription(
        `Prize: **${giveaway.prize}**\nNew Winners: ${winners.map((w) => `<@${w}>`).join(', ')}\nHosted by: ${interaction.user}\nParticipants: ${giveaway.participants.length}`
      );
      await message.edit({ embeds: [embed] }).catch(() => null);
    }

    // Create winner embed
    const winnerEmbed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Winners! 🎉')
      .setDescription(
        `Congratulations to the new winners of **${giveaway.prize}**!\n\n**Winners:** ${winners.map((w) => `<@${w}>`).join(', ')}\n\nThank you to all participants!`
      )
      .setColor('#00FF00')
      .setTimestamp();

    if (giveaway.image) {
      winnerEmbed.setImage(giveaway.image);
    }

    // Set winner's avatar as thumbnail if there's only one winner
    if (winners.length === 1) {
      const winnerUser = await interaction.guild.members.fetch(winners[0]).catch(() => null);
      if (winnerUser) {
        winnerEmbed.setThumbnail(winnerUser.user.displayAvatarURL({ dynamic: true, size: 256 }));
      }
    }

    await interaction.editReply({
      content: `🎉 New winners: ${winners.map((w) => `<@${w}>`).join(', ')}! Congratulations!`,
    });

    // Announce new winners in the channel with embed
    await channel
      .send({ embeds: [winnerEmbed] })
      .catch(() => null);
  } catch (error) {
    console.error('Error rerolling giveaway:', error);
    if (!interaction.replied) {
      await interaction.reply({
        content:
          'An error occurred while rerolling the giveaway. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.followUp({
        content:
          'An error occurred while rerolling the giveaway. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

module.exports = rerollGiveaway;

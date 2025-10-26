const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { ActivityData } = require('../../models/Activity');
const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const sharp = require('sharp');
const fetch = require('node-fetch');

function getStatusColor(status) {
  switch (status) {
    case 'online':
      return '#43B581';
    case 'idle':
      return '#F9A825';
    case 'dnd':
      return '#E84118';
    case 'offline':
    default:
      return '#7E7B7A';
  }
}

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('activity-leaderboard')
    .setDescription('View the activity leaderboard dashboard.')
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Time period to view')
        .setRequired(true)
        .addChoices(
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of users to show (default 10)')
        .setMinValue(1)
        .setMaxValue(10)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const period = interaction.options.getString('period');
    const limit = interaction.options.getInteger('limit') || 10;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate;

    if (period === 'daily') {
      startDate = today;
    } else if (period === 'weekly') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
    } else if (period === 'monthly') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const topUsers = await ActivityData.find({
      guildId: interaction.guild.id,
      date: { $gte: startDate },
    })
      .sort({ [`${period}Count`]: -1 })
      .limit(limit)
      .lean();

    if (topUsers.length === 0) {
      return interaction.editReply({
        content: `No activity data found for ${period} period.`,
        flags: 64,
      });
    }

    const canvasWidth = 1600;
    const canvasHeight = 800 + (topUsers.length - 1) * 120; // Dynamic height based on users
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Orange gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#FFA500'); // Orange
    gradient.addColorStop(1, '#FF8C00'); // Darker orange
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border: black
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 15;
    ctx.strokeRect(7.5, 7.5, canvas.width - 15, canvas.height - 15);

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Activity Leaderboard - ${period.charAt(0).toUpperCase() + period.slice(1)}`, canvasWidth / 2, 60);

    // Column headers
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('Rank', 80, 120);
    ctx.fillText('User', 200, 120);
    ctx.fillText('Messages', 600, 120);
    ctx.fillText('Reactions', 750, 120);
    ctx.fillText('Voice (min)', 900, 120);
    ctx.fillText('Stream (min)', 1100, 120);
    ctx.fillText('Streak', 1220, 120);
    ctx.fillText('Highest', 1320, 120);
    ctx.fillText('Score', 1420, 120);

    // Draw header separator line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 140);
    ctx.lineTo(canvasWidth - 50, 140);
    ctx.stroke();

    let yOffset = 180;

    for (let i = 0; i < topUsers.length; i++) {
      const userData = topUsers[i];
      const rank = i + 1;

      try {
        const member = await interaction.guild.members.fetch(userData.userId).catch(() => null);
        const username = member ? member.user.username : 'Unknown User';

        // Rank number with medal colors for top 3
        let rankColor = '#000000';
        if (rank === 1) rankColor = '#FFD700'; // Gold
        else if (rank === 2) rankColor = '#C0C0C0'; // Silver
        else if (rank === 3) rankColor = '#CD7F32'; // Bronze

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${rank}`, 80, yOffset + 30);

        // Avatar
        const avatarUrl = member?.user.displayAvatarURL?.({
          extension: 'webp',
          size: 128,
        });

        if (avatarUrl) {
          try {
            const response = await fetch(avatarUrl);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const pngBuffer = await sharp(Buffer.from(buffer))
                .toFormat('png')
                .toBuffer();
              const avatar = await loadImage(pngBuffer);

              ctx.save();
              ctx.beginPath();
              ctx.arc(200, yOffset + 20, 40, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(avatar, 160, yOffset - 20, 80, 80);
              ctx.restore();

              // Status indicator
              const statusColor = getStatusColor(member?.presence?.status);
              ctx.fillStyle = statusColor;
              ctx.beginPath();
              ctx.arc(220, yOffset + 50, 15, 0, Math.PI * 2);
              ctx.fill();
            }
          } catch (error) {
            console.error(`Failed to load avatar for ${username}: ${error.message}`);
          }
        }

        // Username
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(username, 280, yOffset + 35);

        // Stats
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText(userData[`${period}Count`].toString(), 620, yOffset + 35);
        ctx.fillText((userData.reactionsGiven + userData.reactionsReceived).toString(), 780, yOffset + 35);
        ctx.fillText(userData.voiceTime.toString(), 940, yOffset + 35);
        ctx.fillText((userData.streamTime || 0).toString(), 1120, yOffset + 35);
        ctx.fillText(userData.streak.toString(), 1240, yOffset + 35);
        ctx.fillText(userData.highestStreak.toString(), 1340, yOffset + 35);

        // Calculated score (weighted sum)
        const score = userData[`${period}Count`] + (userData.reactionsGiven + userData.reactionsReceived) * 0.5 + userData.voiceTime * 2 + (userData.streamTime || 0) * 1.5 + userData.streak * 10;
        ctx.fillText(Math.floor(score).toString(), 1440, yOffset + 35);

        // Separator line
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, yOffset + 60);
        ctx.lineTo(canvasWidth - 50, yOffset + 60);
        ctx.stroke();

      } catch (error) {
        console.error(`Error processing user ${userData.userId}: ${error.message}`);
      }

      yOffset += 120;
    }

    // Footer
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score = Messages + (Reactions × 0.5) + (Voice × 2) + (Stream × 1.5) + (Streak × 10)`, canvasWidth / 2, canvasHeight - 30);

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
      name: 'activity-leaderboard.png',
    });

    await interaction.editReply({
      content: `Activity Leaderboard - ${period.charAt(0).toUpperCase() + period.slice(1)} Period:`,
      files: [attachment],
    });
  },
};

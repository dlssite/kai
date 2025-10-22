const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { ActivityData } = require('../../models/Activity');
const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const sharp = require('sharp');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Check your detailed activity stats dashboard.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to check.')
    ),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const activityData = await ActivityData.findOne({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      date: { $gte: today },
    });

    if (!activityData) {
      return interaction.editReply({
        content: `${targetUser.username} has no activity data for today.`,
        flags: 64,
      });
    }

    const canvasWidth = 1200;
    const canvasHeight = 900;
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

    const avatarUrl = targetUser.displayAvatarURL?.({
      extension: 'webp',
      size: 256,
    });

    if (!avatarUrl) {
      console.error(`Failed to fetch avatar URL for ${targetUser.username}`);
      return interaction.editReply({
        content: `Could not retrieve avatar for ${targetUser.username}.`,
        flags: 64,
      });
    }

    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch avatar image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const pngBuffer = await sharp(Buffer.from(buffer))
        .toFormat('png')
        .toBuffer();

      const avatar = await loadImage(pngBuffer);

      const avatarSize = 200;
      const avatarX = 50;
      const avatarY = 50;

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      const statusColor = this.getStatusColor(
        interaction.guild.members.cache.get(targetUser.id)?.presence?.status
      );
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize - 45,
        avatarY + avatarSize - 25,
        20,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } catch (error) {
      console.error(`Failed to load or convert avatar image: ${error.message}`);
      return interaction.editReply({
        content: `Could not load avatar image for ${targetUser.username}.`,
        flags: 64,
      });
    }

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.fillText(`${targetUser.username}'s Activity Dashboard`, 280, 80);

    // Stats boxes
    const boxWidth = 250;
    const boxHeight = 120;
    const boxSpacing = 20;
    const startX = 50;
    const startY = 300;

    // Messages box
    this.drawStatBox(ctx, startX, startY, boxWidth, boxHeight, 'Messages', activityData.dailyCount, '#FF6B35');
    // Reactions Given box
    this.drawStatBox(ctx, startX + boxWidth + boxSpacing, startY, boxWidth, boxHeight, 'Reactions Given', activityData.reactionsGiven, '#F7931E');
    // Reactions Received box
    this.drawStatBox(ctx, startX + 2 * (boxWidth + boxSpacing), startY, boxWidth, boxHeight, 'Reactions Received', activityData.reactionsReceived, '#FFD23F');
    // Voice Time box
    this.drawStatBox(ctx, startX + 3 * (boxWidth + boxSpacing), startY, boxWidth, boxHeight, 'Voice Time (min)', activityData.voiceTime, '#06FFA5');

    // Second row
    const secondRowY = startY + boxHeight + boxSpacing;
    // Commands Used box
    this.drawStatBox(ctx, startX, secondRowY, boxWidth, boxHeight, 'Commands Used', activityData.commandsUsed, '#4ECDC4');
    // Attachments Sent box
    this.drawStatBox(ctx, startX + boxWidth + boxSpacing, secondRowY, boxWidth, boxHeight, 'Attachments Sent', activityData.attachmentsSent, '#45B7D1');
    // Mentions Given box
    this.drawStatBox(ctx, startX + 2 * (boxWidth + boxSpacing), secondRowY, boxWidth, boxHeight, 'Mentions Given', activityData.mentionsGiven, '#96CEB4');
    // Current Streak box
    this.drawStatBox(ctx, startX + 3 * (boxWidth + boxSpacing), secondRowY, boxWidth, boxHeight, 'Current Streak', activityData.streak, '#FFEAA7');

    // Third row for highest streak, weekly, and monthly totals
    const thirdRowY = secondRowY + boxHeight + boxSpacing;
    // Highest Streak box
    this.drawStatBox(ctx, startX, thirdRowY, boxWidth, boxHeight, 'Highest Streak', activityData.highestStreak, '#FF6B9B');
    // Weekly Messages box
    this.drawStatBox(ctx, startX + boxWidth + boxSpacing, thirdRowY, boxWidth, boxHeight, 'Weekly Msgs', activityData.weeklyCount, '#A8E6CF');
    // Monthly Messages box
    this.drawStatBox(ctx, startX + 2 * (boxWidth + boxSpacing), thirdRowY, boxWidth, boxHeight, 'Monthly Msgs', activityData.monthlyCount, '#DCEDC1');

    // Progress bars for goals
    this.drawProgressBar(ctx, 50, 820, 500, 30, 'Daily Goal (50 msgs)', activityData.dailyCount, 50, '#FFA500');
    this.drawProgressBar(ctx, 600, 820, 500, 30, 'Weekly Goal (200 msgs)', activityData.weeklyCount, 200, '#FF6B35');

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
      name: 'activity-dashboard.png',
    });

    await interaction.editReply({
      content: `${targetUser.username}'s Activity Dashboard:`,
      files: [attachment],
    });
  },

  drawStatBox(ctx, x, y, width, height, label, value, color) {
    // Box background
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, width, height, 15);
    ctx.fill();

    // Box border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + width / 2, y + 30);

    // Value
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText(value.toString(), x + width / 2, y + 80);
    ctx.textAlign = 'left';
  },

  drawProgressBar(ctx, x, y, width, height, label, current, max, color) {
    // Label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(label, x, y - 5);

    // Background
    ctx.fillStyle = '#000000';
    this.roundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    // Progress
    const progress = Math.min(current / max, 1);
    if (progress > 0) {
      ctx.fillStyle = color;
      this.roundRect(ctx, x, y, width * progress, height, 10);
      ctx.fill();
    }

    // Percentage
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`${Math.floor(progress * 100)}%`, x + width + 10, y + height / 2 + 5);
  },

  roundRect(ctx, x, y, width, height, radius) {
    const r = x + width;
    const b = y + height;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(r - radius, y);
    ctx.quadraticCurveTo(r, y, r, y + radius);
    ctx.lineTo(r, b - radius);
    ctx.quadraticCurveTo(r, b, r - radius, b);
    ctx.lineTo(x + radius, b);
    ctx.quadraticCurveTo(x, b, x, b - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    return ctx;
  },

  getStatusColor(status) {
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
  },
};

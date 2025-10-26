const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');
const { ActivityData } = require('../../models/Activity');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
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
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('activity-admin')
    .setDescription('Admin commands for managing activity tracking')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view-top')
        .setDescription('View top active users in an image dashboard')
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
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('manage')
        .setDescription('Interactive management panel for activity data')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup-roles')
        .setDescription('Set up activity-based auto-roles')
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You do not have the `Administrator` permission to manage activity tracking!',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view-top') {
      await this.handleViewTop(interaction);
    } else if (subcommand === 'manage') {
      await this.handleManage(interaction);
    } else if (subcommand === 'setup-roles') {
      await this.handleSetupRoles(interaction);
    }
  },

  async handleViewTop(interaction) {
    await interaction.deferReply({ ephemeral: true });

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
      });
    }

    const canvasWidth = 1600;
    const canvasHeight = 800 + (topUsers.length - 1) * 120;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Orange gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#FFA500');
    gradient.addColorStop(1, '#FF8C00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 15;
    ctx.strokeRect(7.5, 7.5, canvas.width - 15, canvas.height - 15);

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Admin Top ${limit} - ${period.charAt(0).toUpperCase() + period.slice(1)}`, canvasWidth / 2, 60);

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

    // Separator line
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

        let rankColor = '#000000';
        if (rank === 1) rankColor = '#FFD700';
        else if (rank === 2) rankColor = '#C0C0C0';
        else if (rank === 3) rankColor = '#CD7F32';

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${rank}`, 80, yOffset + 30);

        // Avatar
        const avatarUrl = member?.user.displayAvatarURL?.({ extension: 'webp', size: 128 });
        if (avatarUrl) {
          try {
            const response = await fetch(avatarUrl);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const pngBuffer = await sharp(Buffer.from(buffer)).toFormat('png').toBuffer();
              const avatar = await loadImage(pngBuffer);

              ctx.save();
              ctx.beginPath();
              ctx.arc(200, yOffset + 20, 40, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(avatar, 160, yOffset - 20, 80, 80);
              ctx.restore();

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

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(username, 280, yOffset + 35);

        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText(userData[`${period}Count`].toString(), 620, yOffset + 35);
        ctx.fillText((userData.reactionsGiven + userData.reactionsReceived).toString(), 780, yOffset + 35);
        ctx.fillText(userData.voiceTime.toString(), 940, yOffset + 35);
        ctx.fillText((userData.streamTime || 0).toString(), 1120, yOffset + 35);
        ctx.fillText(userData.streak.toString(), 1240, yOffset + 35);
        ctx.fillText(userData.highestStreak.toString(), 1340, yOffset + 35);

        const score = userData[`${period}Count`] + (userData.reactionsGiven + userData.reactionsReceived) * 0.5 + userData.voiceTime * 2 + (userData.streamTime || 0) * 1.5 + userData.streak * 10;
        ctx.fillText(Math.floor(score).toString(), 1440, yOffset + 35);

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

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score = Messages + (Reactions × 0.5) + (Voice × 2) + (Stream × 1.5) + (Streak × 10)`, canvasWidth / 2, canvasHeight - 30);

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'admin-top-users.png' });

    await interaction.editReply({
      content: `Admin View - Top ${limit} Users (${period.charAt(0).toUpperCase() + period.slice(1)}):`,
      files: [attachment],
    });
  },

  async handleManage(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Activity Management Panel')
      .setDescription('Choose an action to manage activity data:')
      .setColor('#FFA500')
      .setTimestamp();

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reset_user')
          .setLabel('Reset User')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId('reset_all')
          .setLabel('Reset All')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('reset_streaks')
          .setLabel('Reset Streaks')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('view_stats')
          .setLabel('View Server Stats')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('export_data')
          .setLabel('Export Data')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📤')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true,
    });
  },

  async handleSetupRoles(interaction) {
    const { ActivityRoles } = require('../../models/ActivityRoles');

    let activityRoles = await ActivityRoles.findOne({ guildId: interaction.guild.id });
    if (!activityRoles) {
      activityRoles = new ActivityRoles({ guildId: interaction.guild.id });
      await activityRoles.save();
    }

    const embed = new EmbedBuilder()
      .setTitle('Activity Auto-Roles Setup')
      .setDescription('Configure roles for activity-based rankings. Select a tier to set the role:')
      .setColor('#FFA500')
      .addFields(
        { name: 'Top 1-3', value: activityRoles.top1to3RoleId ? `<@&${activityRoles.top1to3RoleId}>` : 'Not set', inline: true },
        { name: 'Top 4-10', value: activityRoles.top4to10RoleId ? `<@&${activityRoles.top4to10RoleId}>` : 'Not set', inline: true },
        { name: 'Top 11-15', value: activityRoles.top11to15RoleId ? `<@&${activityRoles.top11to15RoleId}>` : 'Not set', inline: true },
        { name: 'Top 16-20', value: activityRoles.top16to20RoleId ? `<@&${activityRoles.top16to20RoleId}>` : 'Not set', inline: true },
        { name: 'Overall Active', value: activityRoles.overallActiveRoleId ? `<@&${activityRoles.overallActiveRoleId}>` : 'Not set', inline: true },
        { name: 'Inactive', value: activityRoles.inactiveRoleId ? `<@&${activityRoles.inactiveRoleId}>` : 'Not set', inline: true }
      )
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_activity_role_tier')
      .setPlaceholder('Choose a tier to configure')
      .addOptions(
        { label: 'Top 1-3', value: 'top1to3', description: 'Role for top 3 active users' },
        { label: 'Top 4-10', value: 'top4to10', description: 'Role for top 4-10 active users' },
        { label: 'Top 11-15', value: 'top11to15', description: 'Role for top 11-15 active users' },
        { label: 'Top 16-20', value: 'top16to20', description: 'Role for top 16-20 active users' },
        { label: 'Overall Active', value: 'overallActive', description: 'Role for generally active users' },
        { label: 'Inactive', value: 'inactive', description: 'Role for users inactive for 1+ week' }
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};

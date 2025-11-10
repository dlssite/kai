const { Events, MessageFlags } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }

        // --- Restrict bot usage by allowed roles for all commands except manage_access and admin commands ---
        const ServerAIConfig = require('../../models/ServerAIConfig');
        const config = await ServerAIConfig.findOne({ guildId: interaction.guild.id });
        const allowedRoles = config && Array.isArray(config.allowedRoles) ? config.allowedRoles : [];
        const isAdminCommand = command.data.name === 'manage_access' || interaction.member.permissions.has('Administrator');
        if (allowedRoles.length > 0 && !isAdminCommand) {
          const memberRoles = interaction.member.roles.cache.map(r => r.id);
          const hasAllowedRole = memberRoles.some(roleId => allowedRoles.includes(roleId));
          if (!hasAllowedRole) {
            await interaction.reply({ content: 'Sorry, this bot is currently exclusive to certain roles. Please contact an admin for access.', ephemeral: true });
            return;
          }
        }

        // Track command usage for activity
        if (command.data.name !== 'activity' && command.data.name !== 'activity-admin') {
          const { ActivityData } = require('../../models/Activity');
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let activityData = await ActivityData.findOne({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            date: { $gte: today },
          });

          if (!activityData) {
            activityData = new ActivityData({
              guildId: interaction.guild.id,
              userId: interaction.user.id,
              date: today,
              dailyCount: 0,
              weeklyCount: 0,
              monthlyCount: 0,
              streak: 0,
              lastActive: new Date(),
            });
          }

          activityData.commandsUsed += 1;
          await activityData.save();
        }

        try {
          // Log command execution (non-blocking)
          const { logActivity } = require('../../utils/logger');
          logActivity(interaction.client, interaction.guild.id, 'Command Executed', {
            user: interaction.user.id,
            channel: interaction.channel.id,
            command: interaction.commandName,
          }).catch(err => console.error('Logging error:', err));

          await command.execute(interaction);
        } catch (error) {
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: 'There was an error while executing this command!',
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            await interaction.reply({
              content: 'There was an error while executing this command!',
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
    }


    // --- Interactive memory management for /manage_memory ---
    const UserProfile = require('../../models/UserProfile');
    // Handle select menu for memory selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('memory_select_')) {
      const userId = interaction.customId.replace('memory_select_', '');
      const selectedIdx = parseInt(interaction.values[0], 10);
      const profile = await UserProfile.findOne({ userId });
      if (!profile || !profile.memory[selectedIdx]) {
        await interaction.reply({ content: 'Memory entry not found.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Selected: "${profile.memory[selectedIdx]}". Use Remove or Modify.`, ephemeral: true });
      return;
    }

    // --- Interactive AI config management for /manage_ai ---
    const ServerAIConfig = require('../../models/ServerAIConfig');

      // --- Interactive access control for /manage_access ---
      if (interaction.isStringSelectMenu() && interaction.customId === 'access_roles') {
          // Save selected roles immediately to DB
          await ServerAIConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { allowedRoles: interaction.values, updatedAt: new Date() },
            { upsert: true }
          );
          await interaction.reply({ content: `Allowed roles updated to: ${interaction.values.map(id => `<@&${id}>`).join(', ')}`, ephemeral: true });
          return;
      }
      if (interaction.isButton() && interaction.customId === 'save_access_roles') {
          // Just confirm update
          await interaction.reply({ content: `Allowed roles have been saved.`, ephemeral: true });
          return;
      }
    if (interaction.isButton()) {
      const editFields = ['persona', 'bio', 'lore', 'hierarchy'];
      for (const field of editFields) {
        if (interaction.customId === `edit_${field}`) {
          const modal = {
            customId: `ai_edit_modal_${field}`,
            title: `Edit AI ${field.charAt(0).toUpperCase() + field.slice(1)}`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: field,
                    label: `New ${field.charAt(0).toUpperCase() + field.slice(1)}`,
                    style: 2,
                    min_length: 1,
                    max_length: 2000,
                    required: true,
                  },
                ],
              },
            ],
          };
          await interaction.showModal(modal);
          return;
        }
      }
      if (interaction.customId === 'reset_ai') {
        const guildId = interaction.guild.id;
        await ServerAIConfig.findOneAndUpdate(
          { guildId },
          { persona: '', bio: '', lore: '', hierarchy: '', updatedAt: new Date() },
          { upsert: true }
        );
        await interaction.reply({ content: 'AI config has been reset.', ephemeral: true });
        return;
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ai_edit_modal_')) {
      await interaction.deferReply({ ephemeral: true }); // FIRST!
      const field = interaction.customId.replace('ai_edit_modal_', '');
      const value = interaction.fields.getTextInputValue(field);
      const guildId = interaction.guild.id;
      let config = await ServerAIConfig.findOne({ guildId });
      if (!config) {
        config = new ServerAIConfig({ guildId });
      }
      config[field] = value;
      config.updatedAt = new Date();
      await config.save();
      await interaction.editReply({ content: `AI ${field} updated!` });
      return;
    }

    // Handle modal submissions for add/modify
    if (interaction.isModalSubmit() && interaction.customId.startsWith('memory_add_modal_')) {
      const userId = interaction.customId.replace('memory_add_modal_', '');
      const fact = interaction.fields.getTextInputValue('fact');
      let profile = await UserProfile.findOne({ userId });
      if (!profile) {
        profile = new UserProfile({ userId, memory: [fact] });
      } else {
        profile.memory.push(fact);
        profile.updatedAt = new Date();
      }
      await profile.save();
      await interaction.reply({ content: `Added: "${fact}"`, ephemeral: true });
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('memory_modify_modal_')) {
      const userId = interaction.customId.replace('memory_modify_modal_', '');
      const fact = interaction.fields.getTextInputValue('fact');
      let profile = await UserProfile.findOne({ userId });
      if (!profile || !profile.memory.length) {
        await interaction.reply({ content: 'No memory to modify.', ephemeral: true });
        return;
      }
      profile.memory[profile.memory.length - 1] = fact;
      profile.updatedAt = new Date();
      await profile.save();
      await interaction.reply({ content: `Modified last memory to: "${fact}"`, ephemeral: true });
      return;
    }

    // Handle activity admin button interactions
    if (interaction.isButton() && ['reset_user', 'reset_all', 'reset_streaks', 'view_stats', 'export_data'].includes(interaction.customId)) {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
          content: 'You do not have the `Administrator` permission to manage activity tracking!',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const { ActivityData } = require('../../models/Activity');

      if (interaction.customId === 'view_stats') {
        const totalUsers = await ActivityData.distinct('userId', { guildId: interaction.guild.id });
        const totalMessages = await ActivityData.aggregate([
          { $match: { guildId: interaction.guild.id } },
          { $group: { _id: null, total: { $sum: '$dailyCount' } } }
        ]);
        const totalVoiceTime = await ActivityData.aggregate([
          { $match: { guildId: interaction.guild.id } },
          { $group: { _id: null, total: { $sum: '$voiceTime' } } }
        ]);
        const totalReactions = await ActivityData.aggregate([
          { $match: { guildId: interaction.guild.id } },
          { $group: { _id: null, total: { $sum: { $add: ['$reactionsGiven', '$reactionsReceived'] } } } }
        ]);

        const embed = {
          title: 'Server Activity Stats',
          color: 0xFFA500,
          fields: [
            { name: 'Total Users Tracked', value: totalUsers.length.toString(), inline: true },
            { name: 'Total Messages', value: (totalMessages[0]?.total || 0).toString(), inline: true },
            { name: 'Total Voice Time (min)', value: (totalVoiceTime[0]?.total || 0).toString(), inline: true },
            { name: 'Total Reactions', value: (totalReactions[0]?.total || 0).toString(), inline: true },
          ],
          timestamp: new Date(),
        };

        await interaction.editReply({ embeds: [embed] });
      } else if (interaction.customId === 'reset_user') {
        // Show user selection modal or something, but for now, just a placeholder
        await interaction.editReply({ content: 'Reset User functionality not yet implemented. Please specify a user.' });
      } else if (interaction.customId === 'reset_all') {
        // Confirmation prompt
        const confirmEmbed = {
          title: 'Confirm Reset All Activity Data',
          description: 'This will permanently delete ALL activity data for this server. This action cannot be undone.\n\nAre you sure?',
          color: 0xFF0000,
        };
        const confirmRow = {
          type: 1,
          components: [
            {
              type: 2,
              style: 4, // Danger
              label: 'Yes, Reset All',
              custom_id: 'confirm_reset_all',
            },
            {
              type: 2,
              style: 2, // Secondary
              label: 'Cancel',
              custom_id: 'cancel_reset',
            },
          ],
        };
        await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
      } else if (interaction.customId === 'reset_streaks') {
        // Confirmation prompt
        const confirmEmbed = {
          title: 'Confirm Reset All Streaks',
          description: 'This will reset all user streaks to 0. This action cannot be undone.\n\nAre you sure?',
          color: 0xFFFF00,
        };
        const confirmRow = {
          type: 1,
          components: [
            {
              type: 2,
              style: 4, // Danger
              label: 'Yes, Reset Streaks',
              custom_id: 'confirm_reset_streaks',
            },
            {
              type: 2,
              style: 2, // Secondary
              label: 'Cancel',
              custom_id: 'cancel_reset',
            },
          ],
        };
        await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
      } else if (interaction.customId === 'export_data') {
        // Placeholder for export
        await interaction.editReply({ content: 'Export functionality not yet implemented.' });
      }
      return;
    }

    // Handle confirmation buttons for resets
    if (interaction.isButton() && ['confirm_reset_all', 'confirm_reset_streaks', 'cancel_reset'].includes(interaction.customId)) {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
          content: 'You do not have the `Administrator` permission to manage activity tracking!',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      const { ActivityData } = require('../../models/Activity');

      if (interaction.customId === 'confirm_reset_all') {
        await ActivityData.deleteMany({ guildId: interaction.guild.id });
        await interaction.editReply({ content: 'All activity data has been reset.', embeds: [], components: [] });
      } else if (interaction.customId === 'confirm_reset_streaks') {
        await ActivityData.updateMany({ guildId: interaction.guild.id }, { streak: 0, highestStreak: 0 });
        await interaction.editReply({ content: 'All streaks have been reset.', embeds: [], components: [] });
      } else if (interaction.customId === 'cancel_reset') {
        await interaction.editReply({ content: 'Operation cancelled.', embeds: [], components: [] });
      }
      return;
    }


  },
};

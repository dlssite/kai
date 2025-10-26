const { Events } = require('discord.js');
const { ActivityData } = require('../../models/Activity');
const { ActivityRoles } = require('../../models/ActivityRoles');
const cron = require('node-cron');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log('Activity Role Assigner loaded. Scheduling weekly role assignment...');

    // Schedule role assignment every Sunday at 00:00 (weekly reset)
    cron.schedule('0 0 * * 0', async () => {
      console.log('Running weekly activity role assignment...');
      await assignActivityRoles(client);
    }, {
      timezone: 'UTC' // Adjust timezone as needed
    });

    // Also run on bot startup for testing
    setTimeout(() => assignActivityRoles(client), 5000); // 5 second delay after ready
  },
};

async function assignActivityRoles(client) {
  try {
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
      const activityRoles = await ActivityRoles.findOne({ guildId });
      if (!activityRoles) continue;

      // Get weekly activity data
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const weeklyData = await ActivityData.find({
        guildId,
        date: { $gte: weekStart },
      }).lean();

      // Aggregate user activity
      const userActivity = {};
      weeklyData.forEach(data => {
        if (!userActivity[data.userId]) {
          userActivity[data.userId] = {
            messages: 0,
            reactions: 0,
            voiceTime: 0,
            streak: 0,
          };
        }
        userActivity[data.userId].messages += data.dailyCount;
        userActivity[data.userId].reactions += data.reactionsGiven + data.reactionsReceived;
        userActivity[data.userId].voiceTime += data.voiceTime;
        userActivity[data.userId].streak = Math.max(userActivity[data.userId].streak, data.streak);
      });

      // Calculate scores and sort
      const scoredUsers = Object.entries(userActivity).map(([userId, activity]) => ({
        userId,
        score: activity.messages + (activity.reactions * 0.5) + (activity.voiceTime * 2) + (activity.streak * 10),
        activity,
      })).sort((a, b) => b.score - a.score);

      // Assign roles
      const roleAssignments = {
        top1to3: scoredUsers.slice(0, 3),
        top4to10: scoredUsers.slice(3, 10),
        top11to15: scoredUsers.slice(10, 15),
        top16to20: scoredUsers.slice(15, 20),
      };

      // Clear existing activity roles
      const allMembers = await guild.members.fetch();
      const roleIds = [
        activityRoles.top1to3RoleId,
        activityRoles.top4to10RoleId,
        activityRoles.top11to15RoleId,
        activityRoles.top16to20RoleId,
        activityRoles.overallActiveRoleId,
        activityRoles.inactiveRoleId,
      ].filter(id => id);

      for (const member of allMembers.values()) {
        if (!member.user.bot) {
          for (const roleId of roleIds) {
            if (member.roles.cache.has(roleId)) {
              try {
                await member.roles.remove(roleId);
              } catch (error) {
                console.error(`Failed to remove role ${roleId} from ${member.user.tag}:`, error.message);
              }
            }
          }
        }
      }

      // Assign ranking roles
      for (const [tier, users] of Object.entries(roleAssignments)) {
        const roleId = activityRoles[`${tier}RoleId`];
        if (roleId && users.length > 0) {
          for (const user of users) {
            try {
              const member = await guild.members.fetch(user.userId).catch(() => null);
              if (member && !member.user.bot) {
                await member.roles.add(roleId);
              }
            } catch (error) {
              console.error(`Failed to assign ${tier} role to ${user.userId}:`, error.message);
            }
          }
        }
      }

      // Assign overall active role (users with activity in the last week)
      if (activityRoles.overallActiveRoleId) {
        for (const user of scoredUsers) {
          try {
            const member = await guild.members.fetch(user.userId).catch(() => null);
            if (member && !member.user.bot) {
              await member.roles.add(activityRoles.overallActiveRoleId);
            }
          } catch (error) {
            console.error(`Failed to assign overall active role to ${user.userId}:`, error.message);
          }
        }
      }

      // Assign inactive role (users with no activity in the last week)
      if (activityRoles.inactiveRoleId) {
        const activeUserIds = new Set(scoredUsers.map(u => u.userId));
        for (const member of allMembers.values()) {
          if (!member.user.bot && !activeUserIds.has(member.id)) {
            try {
              await member.roles.add(activityRoles.inactiveRoleId);
            } catch (error) {
              console.error(`Failed to assign inactive role to ${member.user.tag}:`, error.message);
            }
          }
        }
      }

      console.log(`Completed activity role assignment for guild ${guild.name}`);
    }
  } catch (error) {
    console.error('Error in activity role assignment:', error);
  }
}

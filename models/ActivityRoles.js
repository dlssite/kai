const mongoose = require('mongoose');

const activityRolesSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  top1to3RoleId: { type: String, default: null },
  top4to10RoleId: { type: String, default: null },
  top11to15RoleId: { type: String, default: null },
  top16to20RoleId: { type: String, default: null },
  overallActiveRoleId: { type: String, default: null },
  inactiveRoleId: { type: String, default: null },
});

const ActivityRoles = mongoose.model('ActivityRoles', activityRolesSchema);

module.exports = { ActivityRoles };

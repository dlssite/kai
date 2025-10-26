const mongoose = require('mongoose');
const { ActivityData } = require('./models/Activity');

async function checkDuplicates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/kai'); // Adjust connection string if needed

    const duplicates = await ActivityData.aggregate([
      {
        $group: {
          _id: { guildId: '$guildId', userId: '$userId', date: '$date' },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    console.log('Duplicate documents found:', duplicates.length);
    if (duplicates.length > 0) {
      console.log('Sample duplicates:');
      duplicates.slice(0, 3).forEach(dup => {
        console.log('User:', dup._id.userId, 'Date:', dup._id.date, 'Count:', dup.count);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDuplicates();

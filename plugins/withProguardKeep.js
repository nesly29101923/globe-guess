// R8 (release minify) strips Room's generated database classes, which WorkManager (used by expo-notifications and the
// ads SDK) creates by reflection: the app then crashes at start with "Failed to create an instance of
// androidx.work.impl.WorkDatabase". Keep them.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const RULES = `
# --- withProguardKeep (Globe Guess) ---
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class androidx.work.** { *; }
-keep class androidx.room.** { *; }
-dontwarn androidx.room.paging.**
`;

module.exports = function withProguardKeep(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('withProguardKeep')) fs.writeFileSync(file, current + RULES);
      return c;
    },
  ]);
};

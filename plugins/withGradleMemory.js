// Keeps Android builds inside the memory of the free EAS build machine: fewer parallel Gradle tasks
// (each native CMake task runs many clang processes) and a bounded Gradle/Kotlin heap.
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'org.gradle.jvmargs': '-Xmx3072m -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8',
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '2',
  'kotlin.daemon.jvmargs': '-Xmx1536m',
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (c) => {
    for (const [key, value] of Object.entries(PROPS)) {
      c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === key));
      c.modResults.push({ type: 'property', key, value });
    }
    return c;
  });
};

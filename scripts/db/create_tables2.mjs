import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const tables = [
  `CREATE TABLE IF NOT EXISTS \`courses\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`schoolId\` int NOT NULL,
    \`code\` varchar(32) NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`description\` text,
    \`credits\` int NOT NULL,
    \`difficultyLevel\` int NOT NULL DEFAULT 3,
    \`workloadHours\` float NOT NULL DEFAULT 9,
    \`availableFall\` boolean NOT NULL DEFAULT true,
    \`availableSpring\` boolean NOT NULL DEFAULT true,
    \`availableSummer\` boolean NOT NULL DEFAULT false,
    \`isUpperDivision\` boolean NOT NULL DEFAULT false,
    \`tagsJson\` text,
    \`careerTracksJson\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`courses_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`degree_requirements\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`categoryId\` int NOT NULL,
    \`courseId\` int NOT NULL,
    \`isRequired\` boolean NOT NULL DEFAULT true,
    \`alternativeCourseIdsJson\` text,
    \`notes\` text,
    CONSTRAINT \`degree_requirements_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`career_tracks\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(128) NOT NULL,
    \`slug\` varchar(64) NOT NULL,
    \`description\` text,
    \`icon\` varchar(64),
    \`priorityCourseIdsJson\` text,
    \`recommendedByYearJson\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`career_tracks_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`career_tracks_slug_unique\` UNIQUE(\`slug\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`student_profiles\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`schoolId\` int,
    \`primaryMajorId\` int,
    \`secondaryMajorId\` int,
    \`minorIdsJson\` text,
    \`apCreditsJson\` text,
    \`transferCreditsJson\` text,
    \`completedCourseIdsJson\` text,
    \`targetGraduationYear\` int,
    \`targetGraduationSemester\` enum('fall','spring'),
    \`startYear\` int,
    \`startSemester\` enum('fall','spring'),
    \`careerTrackId\` int,
    \`preferencesJson\` text,
    \`isSetupComplete\` boolean NOT NULL DEFAULT false,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`student_profiles_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`student_profiles_userId_unique\` UNIQUE(\`userId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`scenario_simulations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`basePlanId\` int NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`scenarioType\` enum('drop_course','add_major','change_graduation','fail_course','add_minor','custom') NOT NULL,
    \`parametersJson\` text,
    \`resultPlanDataJson\` text,
    \`impactSummary\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`scenario_simulations_id\` PRIMARY KEY(\`id\`)
  )`,
];

for (const sql of tables) {
  const name = sql.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/)?.[1];
  try {
    await conn.execute(sql);
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
  }
}

await conn.end();
console.log("All done!");

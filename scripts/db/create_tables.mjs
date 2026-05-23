import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env from the project root.
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

const tables = [
  `CREATE TABLE IF NOT EXISTS \`schools\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`shortName\` varchar(64) NOT NULL,
    \`location\` varchar(256),
    \`semesterSystem\` enum('semester','quarter','trimester') NOT NULL DEFAULT 'semester',
    \`maxCreditsPerSemester\` int NOT NULL DEFAULT 18,
    \`minCreditsPerSemester\` int NOT NULL DEFAULT 12,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`schools_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`programs\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`schoolId\` int NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`shortName\` varchar(64) NOT NULL,
    \`type\` enum('major','minor','concentration') NOT NULL,
    \`totalCreditsRequired\` int NOT NULL,
    \`description\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`programs_id\` PRIMARY KEY(\`id\`)
  )`,
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
    \`tagsJson\` text DEFAULT '[]',
    \`careerTracksJson\` text DEFAULT '[]',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`courses_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`prerequisites\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`courseId\` int NOT NULL,
    \`prerequisiteCourseId\` int NOT NULL,
    \`type\` enum('required','corequisite','recommended') NOT NULL DEFAULT 'required',
    \`minimumGrade\` varchar(4) DEFAULT 'D',
    CONSTRAINT \`prerequisites_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`requirement_categories\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`programId\` int NOT NULL,
    \`name\` varchar(128) NOT NULL,
    \`type\` enum('core','elective','general_education','capstone','thesis','free_elective') NOT NULL,
    \`creditsRequired\` int NOT NULL,
    \`coursesRequired\` int,
    \`description\` text,
    \`sortOrder\` int DEFAULT 0,
    CONSTRAINT \`requirement_categories_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`degree_requirements\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`categoryId\` int NOT NULL,
    \`courseId\` int NOT NULL,
    \`isRequired\` boolean NOT NULL DEFAULT true,
    \`alternativeCourseIdsJson\` text DEFAULT '[]',
    \`notes\` text,
    CONSTRAINT \`degree_requirements_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`career_tracks\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(128) NOT NULL,
    \`slug\` varchar(64) NOT NULL,
    \`description\` text,
    \`icon\` varchar(64),
    \`priorityCourseIdsJson\` text DEFAULT '[]',
    \`recommendedByYearJson\` text DEFAULT '{}',
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
    \`minorIdsJson\` text DEFAULT '[]',
    \`apCreditsJson\` text DEFAULT '[]',
    \`transferCreditsJson\` text DEFAULT '[]',
    \`completedCourseIdsJson\` text DEFAULT '[]',
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
  `CREATE TABLE IF NOT EXISTS \`degree_plans\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`variantType\` enum('fastest_path','lowest_stress_path','most_flexible_path','custom') NOT NULL,
    \`isActive\` boolean NOT NULL DEFAULT false,
    \`isSaved\` boolean NOT NULL DEFAULT false,
    \`totalCredits\` int DEFAULT 0,
    \`totalSemesters\` int DEFAULT 0,
    \`estimatedGraduationYear\` int,
    \`estimatedGraduationSemester\` enum('fall','spring'),
    \`scoresJson\` text,
    \`metadataJson\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`degree_plans_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`plan_semesters\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`planId\` int NOT NULL,
    \`semesterIndex\` int NOT NULL,
    \`year\` int NOT NULL,
    \`term\` enum('fall','spring','summer') NOT NULL,
    \`totalCredits\` int DEFAULT 0,
    \`workloadScore\` float DEFAULT 0,
    \`difficultyScore\` float DEFAULT 0,
    \`notes\` text,
    CONSTRAINT \`plan_semesters_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`plan_courses\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`semesterId\` int NOT NULL,
    \`courseId\` int NOT NULL,
    \`status\` enum('planned','enrolled','completed','dropped','failed','waived') NOT NULL DEFAULT 'planned',
    \`grade\` varchar(4),
    \`isSubstitution\` boolean DEFAULT false,
    \`substituteForCourseId\` int,
    \`notes\` text,
    CONSTRAINT \`plan_courses_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`scenario_simulations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`basePlanId\` int NOT NULL,
    \`name\` varchar(256) NOT NULL,
    \`scenarioType\` enum('drop_course','add_major','change_graduation','fail_course','add_minor','custom') NOT NULL,
    \`parametersJson\` text DEFAULT '{}',
    \`resultPlanDataJson\` text,
    \`impactSummary\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`scenario_simulations_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`chat_messages\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`planId\` int,
    \`role\` enum('user','assistant') NOT NULL,
    \`content\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`chat_messages_id\` PRIMARY KEY(\`id\`)
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
console.log("Done!");

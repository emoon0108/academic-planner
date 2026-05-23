import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  float,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Schools ─────────────────────────────────────────────────────────────────
export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  shortName: varchar("shortName", { length: 64 }).notNull(),
  location: varchar("location", { length: 256 }),
  semesterSystem: mysqlEnum("semesterSystem", ["semester", "quarter", "trimester"]).default("semester").notNull(),
  maxCreditsPerSemester: int("maxCreditsPerSemester").default(18).notNull(),
  minCreditsPerSemester: int("minCreditsPerSemester").default(12).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type School = typeof schools.$inferSelect;

// ─── Programs (Majors / Minors) ───────────────────────────────────────────────
export const programs = mysqlTable("programs", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  shortName: varchar("shortName", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["major", "minor", "concentration"]).notNull(),
  totalCreditsRequired: int("totalCreditsRequired").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Program = typeof programs.$inferSelect;

// ─── Courses ─────────────────────────────────────────────────────────────────
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  credits: int("credits").notNull(),
  difficultyLevel: int("difficultyLevel").default(3).notNull(),
  workloadHours: float("workloadHours").default(9).notNull(),
  availableFall: boolean("availableFall").default(true).notNull(),
  availableSpring: boolean("availableSpring").default(true).notNull(),
  availableSummer: boolean("availableSummer").default(false).notNull(),
  isUpperDivision: boolean("isUpperDivision").default(false).notNull(),
  tagsJson: text("tagsJson").default("[]"),
  careerTracksJson: text("careerTracksJson").default("[]"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;

// ─── Prerequisites ────────────────────────────────────────────────────────────
export const prerequisites = mysqlTable("prerequisites", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  prerequisiteCourseId: int("prerequisiteCourseId").notNull(),
  type: mysqlEnum("type", ["required", "corequisite", "recommended"]).default("required").notNull(),
  minimumGrade: varchar("minimumGrade", { length: 4 }).default("D"),
});

export type Prerequisite = typeof prerequisites.$inferSelect;

// ─── Requirement Categories ───────────────────────────────────────────────────
export const requirementCategories = mysqlTable("requirement_categories", {
  id: int("id").autoincrement().primaryKey(),
  programId: int("programId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["core", "elective", "general_education", "capstone", "thesis", "free_elective"]).notNull(),
  creditsRequired: int("creditsRequired").notNull(),
  coursesRequired: int("coursesRequired"),
  description: text("description"),
  sortOrder: int("sortOrder").default(0),
});

export type RequirementCategory = typeof requirementCategories.$inferSelect;

// ─── Degree Requirements ──────────────────────────────────────────────────────
export const degreeRequirements = mysqlTable("degree_requirements", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  courseId: int("courseId").notNull(),
  isRequired: boolean("isRequired").default(true).notNull(),
  alternativeCourseIdsJson: text("alternativeCourseIdsJson").default("[]"),
  notes: text("notes"),
});

export type DegreeRequirement = typeof degreeRequirements.$inferSelect;

// ─── Career Tracks ────────────────────────────────────────────────────────────
export const careerTracks = mysqlTable("career_tracks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }),
  priorityCourseIdsJson: text("priorityCourseIdsJson").default("[]"),
  recommendedByYearJson: text("recommendedByYearJson").default("{}"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CareerTrack = typeof careerTracks.$inferSelect;

// ─── Student Profiles ─────────────────────────────────────────────────────────
export const studentProfiles = mysqlTable("student_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  schoolId: int("schoolId"),
  primaryMajorId: int("primaryMajorId"),
  secondaryMajorId: int("secondaryMajorId"),
  minorIdsJson: text("minorIdsJson").default("[]"),
  apCreditsJson: text("apCreditsJson").default("[]"),
  transferCreditsJson: text("transferCreditsJson").default("[]"),
  completedCourseIdsJson: text("completedCourseIdsJson").default("[]"),
  targetGraduationYear: int("targetGraduationYear"),
  targetGraduationSemester: mysqlEnum("targetGraduationSemester", ["fall", "spring"]),
  startYear: int("startYear"),
  startSemester: mysqlEnum("startSemester", ["fall", "spring"]),
  careerTrackId: int("careerTrackId"),
  preferencesJson: text("preferencesJson").default('{"workloadBalance":"moderate","earlyGraduation":false,"internshipSemester":null,"maxCreditsPerSemester":18,"minCreditsPerSemester":12,"preferMorningClasses":false,"avoidSummerClasses":true}'),
  isSetupComplete: boolean("isSetupComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentProfile = typeof studentProfiles.$inferSelect;

// ─── Degree Plans ─────────────────────────────────────────────────────────────
export const degreePlans = mysqlTable("degree_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  variantType: mysqlEnum("variantType", ["fastest_path", "lowest_stress_path", "most_flexible_path", "custom"]).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  isSaved: boolean("isSaved").default(false).notNull(),
  totalCredits: int("totalCredits").default(0),
  totalSemesters: int("totalSemesters").default(0),
  estimatedGraduationYear: int("estimatedGraduationYear"),
  estimatedGraduationSemester: mysqlEnum("estimatedGraduationSemester", ["fall", "spring"]),
  scoresJson: text("scoresJson").default('{"workload":0,"difficulty":0,"flexibility":0,"careerReadiness":0,"overall":0}'),
  metadataJson: text("metadataJson").default("{}"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DegreePlan = typeof degreePlans.$inferSelect;

// ─── Plan Semesters ───────────────────────────────────────────────────────────
export const planSemesters = mysqlTable("plan_semesters", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  semesterIndex: int("semesterIndex").notNull(),
  year: int("year").notNull(),
  term: mysqlEnum("term", ["fall", "spring", "summer"]).notNull(),
  totalCredits: int("totalCredits").default(0),
  workloadScore: float("workloadScore").default(0),
  difficultyScore: float("difficultyScore").default(0),
  notes: text("notes"),
});

export type PlanSemester = typeof planSemesters.$inferSelect;

// ─── Plan Courses ─────────────────────────────────────────────────────────────
export const planCourses = mysqlTable("plan_courses", {
  id: int("id").autoincrement().primaryKey(),
  semesterId: int("semesterId").notNull(),
  courseId: int("courseId").notNull(),
  status: mysqlEnum("status", ["planned", "enrolled", "completed", "dropped", "failed", "waived"]).default("planned").notNull(),
  grade: varchar("grade", { length: 4 }),
  isSubstitution: boolean("isSubstitution").default(false),
  substituteForCourseId: int("substituteForCourseId"),
  notes: text("notes"),
});

export type PlanCourse = typeof planCourses.$inferSelect;

// ─── Scenario Simulations ─────────────────────────────────────────────────────
export const scenarioSimulations = mysqlTable("scenario_simulations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  basePlanId: int("basePlanId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  scenarioType: mysqlEnum("scenarioType", ["drop_course", "add_major", "change_graduation", "fail_course", "add_minor", "custom"]).notNull(),
  parametersJson: text("parametersJson").default("{}"),
  resultPlanDataJson: text("resultPlanDataJson"),
  impactSummary: text("impactSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScenarioSimulation = typeof scenarioSimulations.$inferSelect;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

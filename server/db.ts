import { eq, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  schools,
  programs,
  courses,
  prerequisites,
  requirementCategories,
  degreeRequirements,
  careerTracks,
  studentProfiles,
  degreePlans,
  planSemesters,
  planCourses,
  scenarioSimulations,
  chatMessages,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  makeMsuEconomicsCourses,
  makeMsuPrograms,
  makeMsuSchool,
  msuEconomicsDegreeRequirements,
  msuEconomicsPrerequisites,
  msuEconomicsRequirementCategories,
} from "./data/schools/msu";
import {
  makeSutCourses,
  makeSutPrograms,
  makeSutSchool,
  sutDegreeRequirements,
  sutPrerequisites,
  sutRequirementCategories,
} from "./data/schools/sut";
import {
  makeUmichCourses,
  makeUmichDegreeRequirements,
  makeUmichPrerequisites,
  makeUmichPrograms,
  makeUmichRequirementCategories,
  makeUmichSchool,
} from "./data/schools/umich";

let _db: ReturnType<typeof drizzle> | null = null;
const now = () => new Date();
let memoryId = 1000;
const nextId = () => memoryId++;

const memory = {
  users: [] as any[],
  profiles: [] as any[],
  plans: [] as any[],
  semesters: [] as any[],
  planCourses: [] as any[],
  scenarios: [] as any[],
  chatMessages: [] as any[],
  schools: [makeSutSchool(now), makeUmichSchool(now), makeMsuSchool(now)],
  programs: [
    ...makeSutPrograms(now),
    ...makeUmichPrograms(now),
    ...makeMsuPrograms(now),
  ],
  courses: [
    ...makeSutCourses(now),
    ...makeUmichCourses(now),
    ...makeMsuEconomicsCourses(now),
  ],
  prerequisites: [
    ...sutPrerequisites,
    ...makeUmichPrerequisites(),
    ...msuEconomicsPrerequisites,
  ],
  requirementCategories: [
    ...sutRequirementCategories,
    ...makeUmichRequirementCategories(),
    ...msuEconomicsRequirementCategories,
  ],
  degreeRequirements: [
    ...sutDegreeRequirements,
    ...makeUmichDegreeRequirements(),
    ...msuEconomicsDegreeRequirements,
  ],
  careerTracks: [
    {
      id: 1,
      name: "Software Engineering",
      slug: "software_engineering",
      description: "Backend, frontend, and product engineering preparation.",
      icon: "Code",
      priorityCourseIdsJson: "[8,10,11,12,13]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 2,
      name: "Frontend Engineering",
      slug: "frontend_engineering",
      description: "User interface engineering, web apps, and design systems.",
      icon: "Layout",
      priorityCourseIdsJson: "[8,10,12]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 3,
      name: "Backend Engineering",
      slug: "backend_engineering",
      description:
        "APIs, databases, distributed systems, and scalable infrastructure.",
      icon: "Database",
      priorityCourseIdsJson: "[8,10,11,13]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 4,
      name: "Full-Stack Engineering",
      slug: "full_stack_engineering",
      description:
        "End-to-end application development across frontend and backend.",
      icon: "Layers",
      priorityCourseIdsJson: "[8,10,11,12,13]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 5,
      name: "Cybersecurity",
      slug: "cybersecurity",
      description:
        "Security engineering, ethical hacking, and systems protection.",
      icon: "Shield",
      priorityCourseIdsJson: "[8,10,11]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 20,
      name: "Machine Learning",
      slug: "machine_learning",
      description: "Math-heavy preparation for ML and AI.",
      icon: "Brain",
      priorityCourseIdsJson: "[5,9,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 21,
      name: "Artificial Intelligence",
      slug: "artificial_intelligence",
      description:
        "Preparation for AI systems, agents, and intelligent applications.",
      icon: "Bot",
      priorityCourseIdsJson: "[5,9,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 22,
      name: "Data Science",
      slug: "data_science",
      description:
        "Statistics, modeling, programming, and data-driven decision making.",
      icon: "BarChart",
      priorityCourseIdsJson: "[5,9,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 23,
      name: "Computer Vision",
      slug: "computer_vision",
      description:
        "Image processing, perception, and visual intelligence systems.",
      icon: "ScanEye",
      priorityCourseIdsJson: "[5,9,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 24,
      name: "Natural Language Processing",
      slug: "natural_language_processing",
      description:
        "Language models, conversational AI, and text analysis systems.",
      icon: "MessageSquareText",
      priorityCourseIdsJson: "[5,9,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 40,
      name: "Mechanical Engineering",
      slug: "mechanical_engineering",
      description:
        "Mechanics, manufacturing, thermodynamics, and system design.",
      icon: "Cog",
      priorityCourseIdsJson: "[5,6,7]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 41,
      name: "Electrical Engineering",
      slug: "electrical_engineering",
      description:
        "Circuits, electronics, power systems, and signal processing.",
      icon: "Zap",
      priorityCourseIdsJson: "[5,6,7]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 42,
      name: "Computer Engineering",
      slug: "computer_engineering",
      description:
        "Embedded systems, hardware, software, and digital architecture.",
      icon: "Cpu",
      priorityCourseIdsJson: "[7,8,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 43,
      name: "Biomedical Engineering",
      slug: "biomedical_engineering",
      description:
        "Medical technology, biomechanics, and healthcare systems engineering.",
      icon: "HeartPulse",
      priorityCourseIdsJson: "[5,7,9]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 44,
      name: "Aerospace Engineering",
      slug: "aerospace_engineering",
      description:
        "Aircraft, spacecraft, aerodynamics, and propulsion systems.",
      icon: "Rocket",
      priorityCourseIdsJson: "[5,6,7]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 60,
      name: "Investment Banking",
      slug: "investment_banking",
      description:
        "Corporate finance, valuation, and capital markets preparation.",
      icon: "Landmark",
      priorityCourseIdsJson: "[6000,6001,6007,6015]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 61,
      name: "Management Consulting",
      slug: "management_consulting",
      description:
        "Business strategy, analytics, and organizational problem solving.",
      icon: "Presentation",
      priorityCourseIdsJson: "[6000,6001,6004,6015]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 62,
      name: "Entrepreneurship",
      slug: "entrepreneurship",
      description:
        "Startup creation, innovation, leadership, and business building.",
      icon: "Lightbulb",
      priorityCourseIdsJson: "[10,11,6000,6004]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 63,
      name: "Accounting",
      slug: "accounting",
      description: "Financial reporting, auditing, and tax accounting systems.",
      icon: "Calculator",
      priorityCourseIdsJson: "[6000,6001,6007]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 64,
      name: "Marketing",
      slug: "marketing",
      description:
        "Brand strategy, digital marketing, and consumer engagement.",
      icon: "Megaphone",
      priorityCourseIdsJson: "[6000,6004,6011]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 80,
      name: "Corporate Law",
      slug: "corporate_law",
      description:
        "Business law, mergers, governance, and corporate legal systems.",
      icon: "Scale",
      priorityCourseIdsJson: "[6000,6004,6017]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 81,
      name: "Criminal Law",
      slug: "criminal_law",
      description: "Criminal justice, litigation, and courtroom advocacy.",
      icon: "Gavel",
      priorityCourseIdsJson: "[6000,6017]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 82,
      name: "Patent Law",
      slug: "patent_law",
      description:
        "Protecting inventions, engineering innovation, and intellectual property.",
      icon: "FileBadge",
      priorityCourseIdsJson: "[5,7,10]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 83,
      name: "Political Science",
      slug: "political_science",
      description:
        "Government systems, political behavior, and public institutions.",
      icon: "Vote",
      priorityCourseIdsJson: "[6000,6001,6018]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 84,
      name: "Public Policy",
      slug: "public_policy",
      description:
        "Policy analysis, governance, economics, and social systems.",
      icon: "ClipboardList",
      priorityCourseIdsJson: "[6000,6001,6015,6018]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 100,
      name: "Pre-Med",
      slug: "pre_med",
      description: "Preparation for medical school and healthcare careers.",
      icon: "Stethoscope",
      priorityCourseIdsJson: "[9,6000,6028]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 101,
      name: "Nursing",
      slug: "nursing",
      description:
        "Patient care, healthcare systems, and clinical preparation.",
      icon: "HeartHandshake",
      priorityCourseIdsJson: "[9,6028]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 102,
      name: "Psychology",
      slug: "psychology",
      description: "Human behavior, cognition, and mental health studies.",
      icon: "BrainCircuit",
      priorityCourseIdsJson: "[9,6000,6011]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 103,
      name: "Public Health",
      slug: "public_health",
      description: "Population health, epidemiology, and healthcare systems.",
      icon: "Hospital",
      priorityCourseIdsJson: "[9,6000,6028]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 120,
      name: "History",
      slug: "history",
      description:
        "Historical analysis, research, and interpretation of past societies.",
      icon: "BookOpen",
      priorityCourseIdsJson: "[6011,6029]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 121,
      name: "Philosophy",
      slug: "philosophy",
      description: "Logic, ethics, reasoning, and philosophical inquiry.",
      icon: "ScrollText",
      priorityCourseIdsJson: "[6011,6017]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 122,
      name: "English",
      slug: "english",
      description: "Literature, writing, communication, and textual analysis.",
      icon: "Library",
      priorityCourseIdsJson: "[6011,6029]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 123,
      name: "Journalism",
      slug: "journalism",
      description: "Reporting, storytelling, media ethics, and communication.",
      icon: "Newspaper",
      priorityCourseIdsJson: "[6011,6029]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
    {
      id: 124,
      name: "Sociology",
      slug: "sociology",
      description: "Social systems, institutions, and human group behavior.",
      icon: "Users",
      priorityCourseIdsJson: "[6000,6011,6025]",
      recommendedByYearJson: "{}",
      createdAt: now(),
    },
  ],
};

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!_db && databaseUrl) {
    try {
      _db = drizzle(databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    const existing = memory.users.find(u => u.openId === user.openId);
    if (existing) {
      Object.assign(existing, user, {
        updatedAt: now(),
        lastSignedIn: user.lastSignedIn ?? now(),
      });
      return;
    }
    memory.users.push({
      id: nextId(),
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      createdAt: now(),
      updatedAt: now(),
      lastSignedIn: user.lastSignedIn ?? now(),
    });
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return memory.users.find(u => u.openId === openId);
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

// ─── Schools ──────────────────────────────────────────────────────────────────
export async function getAllSchools() {
  const db = await getDb();
  if (!db) return memory.schools;
  return db.select().from(schools);
}

// ─── Programs ─────────────────────────────────────────────────────────────────
export async function getProgramsBySchool(schoolId: number) {
  const db = await getDb();
  if (!db) return memory.programs.filter(p => p.schoolId === schoolId);
  return db.select().from(programs).where(eq(programs.schoolId, schoolId));
}

function makeShortName(name: string) {
  const initials = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .toUpperCase();
  return (initials || name).slice(0, 64);
}

export async function findOrCreateSchool(data: {
  name: string;
  shortName?: string;
  location?: string;
}) {
  const existing = (await getAllSchools()).find(
    school => school.name.toLowerCase() === data.name.toLowerCase()
  );
  if (existing) return existing;

  const db = await getDb();
  const values = {
    name: data.name,
    shortName: data.shortName ?? makeShortName(data.name),
    location: data.location ?? null,
    semesterSystem: "semester" as const,
    maxCreditsPerSemester: 18,
    minCreditsPerSemester: 12,
  };

  if (!db) {
    const school = { id: nextId(), createdAt: now(), ...values, location: values.location ?? "" };
    memory.schools.push(school);
    return school;
  }

  const result = await db.insert(schools).values(values as any);
  const id = (result as any)[0]?.insertId as number;
  return { id, createdAt: now(), ...values };
}

export async function findOrCreateProgram(data: {
  schoolId: number;
  name: string;
  type?: "major" | "minor" | "concentration";
  totalCreditsRequired?: number;
  description?: string;
}) {
  const existing = (await getProgramsBySchool(data.schoolId)).find(
    program => program.name.toLowerCase() === data.name.toLowerCase() && program.type === (data.type ?? "major")
  );
  if (existing) return existing;

  const db = await getDb();
  const values = {
    schoolId: data.schoolId,
    name: data.name,
    shortName: makeShortName(data.name),
    type: data.type ?? "major" as "major" | "minor" | "concentration",
    totalCreditsRequired: data.totalCreditsRequired ?? 120,
    description: data.description ?? "Imported from official catalog research. Review requirements before advising use.",
  };

  if (!db) {
    const program = { id: nextId(), createdAt: now(), ...values };
    memory.programs.push(program as any);
    return program;
  }

  const result = await db.insert(programs).values(values as any);
  const id = (result as any)[0]?.insertId as number;
  return { id, createdAt: now(), ...values };
}

export async function getProgramById(id: number) {
  const db = await getDb();
  if (!db) return memory.programs.find(p => p.id === id);
  const result = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id))
    .limit(1);
  return result[0];
}

// ─── Courses ──────────────────────────────────────────────────────────────────
export async function getCoursesBySchool(schoolId: number) {
  const db = await getDb();
  if (!db) return memory.courses.filter(c => c.schoolId === schoolId);
  return db.select().from(courses).where(eq(courses.schoolId, schoolId));
}

export async function findOrCreateCourse(data: {
  schoolId: number;
  code: string;
  name: string;
  description?: string;
  credits?: number | null;
  tags?: string[];
}) {
  const existing = (await getCoursesBySchool(data.schoolId)).find(
    course => course.code.toLowerCase() === data.code.toLowerCase()
  );
  if (existing) return existing;

  const db = await getDb();
  const values = {
    schoolId: data.schoolId,
    code: data.code.slice(0, 32),
    name: data.name.slice(0, 256),
    description: data.description ?? "Imported from official catalog research. Verify exact title, credits, and prerequisites.",
    credits: data.credits ?? 3,
    difficultyLevel: 3,
    workloadHours: (data.credits ?? 3) * 3,
    availableFall: true,
    availableSpring: true,
    availableSummer: false,
    isUpperDivision: /\b[3-9]\d{2}/.test(data.code),
    tagsJson: JSON.stringify(data.tags ?? ["catalog-import"]),
    careerTracksJson: "[]",
  };

  if (!db) {
    const course = { id: nextId(), createdAt: now(), ...values };
    memory.courses.push(course);
    return course;
  }

  const result = await db.insert(courses).values(values as any);
  const id = (result as any)[0]?.insertId as number;
  return { id, createdAt: now(), ...values };
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return memory.courses.find(c => c.id === id);
  const result = await db
    .select()
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  return result[0];
}

export async function getCoursesByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return memory.courses.filter(c => ids.includes(c.id));
  if (ids.length === 0) return [];
  return db.select().from(courses).where(inArray(courses.id, ids));
}

// ─── Prerequisites ────────────────────────────────────────────────────────────
export async function getPrerequisitesBySchool(schoolId: number) {
  const db = await getDb();
  if (!db) {
    const courseIds = memory.courses
      .filter(c => c.schoolId === schoolId)
      .map(c => c.id);
    return memory.prerequisites.filter(p => courseIds.includes(p.courseId));
  }
  // Join through courses to filter by school
  const schoolCourses = await getCoursesBySchool(schoolId);
  const courseIds = schoolCourses.map(c => c.id);
  if (courseIds.length === 0) return [];
  return db
    .select()
    .from(prerequisites)
    .where(inArray(prerequisites.courseId, courseIds));
}

// ─── Degree Requirements ──────────────────────────────────────────────────────
export async function getRequirementCategoriesByProgram(programId: number) {
  const db = await getDb();
  if (!db)
    return memory.requirementCategories.filter(c => c.programId === programId);
  return db
    .select()
    .from(requirementCategories)
    .where(eq(requirementCategories.programId, programId));
}

export async function getDegreeRequirementsByCategory(categoryId: number) {
  const db = await getDb();
  if (!db)
    return memory.degreeRequirements.filter(r => r.categoryId === categoryId);
  return db
    .select()
    .from(degreeRequirements)
    .where(eq(degreeRequirements.categoryId, categoryId));
}

export async function getDegreeRequirementsByProgram(programId: number) {
  const db = await getDb();
  if (!db) {
    const catIds = memory.requirementCategories
      .filter(c => c.programId === programId)
      .map(c => c.id);
    return memory.degreeRequirements.filter(r => catIds.includes(r.categoryId));
  }
  const cats = await getRequirementCategoriesByProgram(programId);
  if (cats.length === 0) return [];
  const catIds = cats.map(c => c.id);
  return db
    .select()
    .from(degreeRequirements)
    .where(inArray(degreeRequirements.categoryId, catIds));
}

export async function createRequirementCategory(data: {
  programId: number;
  name: string;
  type: "core" | "elective" | "general_education" | "capstone" | "thesis" | "free_elective";
  creditsRequired: number;
  coursesRequired?: number;
  description?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) {
    const id = nextId();
    memory.requirementCategories.push({ id, ...data });
    return id;
  }
  const result = await db.insert(requirementCategories).values(data as any);
  return (result as any)[0]?.insertId as number;
}

export async function createDegreeRequirement(data: {
  categoryId: number;
  courseId: number;
  isRequired?: boolean;
  alternativeCourseIdsJson?: string;
  notes?: string;
}) {
  const db = await getDb();
  const values = {
    isRequired: true,
    alternativeCourseIdsJson: "[]",
    ...data,
  };
  if (!db) {
    const id = nextId();
    memory.degreeRequirements.push({ id, ...values });
    return id;
  }
  const result = await db.insert(degreeRequirements).values(values as any);
  return (result as any)[0]?.insertId as number;
}

// ─── Career Tracks ────────────────────────────────────────────────────────────
export async function getAllCareerTracks() {
  const db = await getDb();
  if (!db) return memory.careerTracks;
  return db.select().from(careerTracks);
}

export async function getCareerTrackById(id: number) {
  const db = await getDb();
  if (!db) return memory.careerTracks.find(t => t.id === id);
  const result = await db
    .select()
    .from(careerTracks)
    .where(eq(careerTracks.id, id))
    .limit(1);
  return result[0];
}

// ─── Student Profiles ─────────────────────────────────────────────────────────
export async function getStudentProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return memory.profiles.find(p => p.userId === userId);
  const result = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertStudentProfile(data: {
  userId: number;
  schoolId?: number;
  primaryMajorId?: number;
  secondaryMajorId?: number;
  minorIdsJson?: string;
  apCreditsJson?: string;
  transferCreditsJson?: string;
  completedCourseIdsJson?: string;
  targetGraduationYear?: number;
  targetGraduationSemester?: "fall" | "spring";
  startYear?: number;
  startSemester?: "fall" | "spring";
  careerTrackId?: number;
  preferencesJson?: string;
  isSetupComplete?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    const existing = memory.profiles.find(p => p.userId === data.userId);
    if (existing) {
      Object.assign(existing, data, { updatedAt: now() });
      return;
    }
    memory.profiles.push({
      id: nextId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    });
    return;
  }
  await db
    .insert(studentProfiles)
    .values(data as any)
    .onDuplicateKeyUpdate({ set: data as any });
}

// ─── Degree Plans ─────────────────────────────────────────────────────────────
export async function getDegreePlansByUser(userId: number) {
  const db = await getDb();
  if (!db) return memory.plans.filter(p => p.userId === userId);
  return db.select().from(degreePlans).where(eq(degreePlans.userId, userId));
}

export async function getDegreePlanById(id: number) {
  const db = await getDb();
  if (!db) return memory.plans.find(p => p.id === id);
  const result = await db
    .select()
    .from(degreePlans)
    .where(eq(degreePlans.id, id))
    .limit(1);
  return result[0];
}

export async function createDegreePlan(data: {
  userId: number;
  name: string;
  variantType:
    | "fastest_path"
    | "lowest_stress_path"
    | "most_flexible_path"
    | "custom";
  totalCredits: number;
  totalSemesters: number;
  estimatedGraduationYear: number;
  estimatedGraduationSemester: "fall" | "spring";
  scoresJson: string;
  isActive?: boolean;
  isSaved?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    const id = nextId();
    memory.plans.push({
      id,
      isActive: memory.plans.filter(p => p.userId === data.userId).length === 0,
      isSaved: true,
      metadataJson: "{}",
      createdAt: now(),
      updatedAt: now(),
      ...data,
    });
    return id;
  }
  const result = await db.insert(degreePlans).values(data as any);
  return (result as any)[0]?.insertId as number;
}

export async function updateDegreePlan(
  id: number,
  data: Partial<{
    isActive: boolean;
    isSaved: boolean;
    scoresJson: string;
    totalCredits: number;
    totalSemesters: number;
    estimatedGraduationYear: number;
    estimatedGraduationSemester: "fall" | "spring";
  }>
) {
  const db = await getDb();
  if (!db) {
    const plan = memory.plans.find(p => p.id === id);
    if (plan) Object.assign(plan, data, { updatedAt: now() });
    return;
  }
  await db
    .update(degreePlans)
    .set(data as any)
    .where(eq(degreePlans.id, id));
}

// ─── Plan Semesters ───────────────────────────────────────────────────────────
export async function getPlanSemesters(planId: number) {
  const db = await getDb();
  if (!db) return memory.semesters.filter(s => s.planId === planId);
  return db
    .select()
    .from(planSemesters)
    .where(eq(planSemesters.planId, planId));
}

export async function createPlanSemester(data: {
  planId: number;
  semesterIndex: number;
  year: number;
  term: "fall" | "spring" | "summer";
  totalCredits: number;
  workloadScore: number;
  difficultyScore: number;
}) {
  const db = await getDb();
  if (!db) {
    const id = nextId();
    memory.semesters.push({ id, notes: null, ...data });
    return id;
  }
  const result = await db.insert(planSemesters).values(data as any);
  return (result as any)[0]?.insertId as number;
}

// ─── Plan Courses ─────────────────────────────────────────────────────────────
export async function getPlanCoursesBySemester(semesterId: number) {
  const db = await getDb();
  if (!db) return memory.planCourses.filter(pc => pc.semesterId === semesterId);
  return db
    .select()
    .from(planCourses)
    .where(eq(planCourses.semesterId, semesterId));
}

export async function getPlanCourseById(id: number) {
  const db = await getDb();
  if (!db) return memory.planCourses.find(pc => pc.id === id);
  const result = await db
    .select()
    .from(planCourses)
    .where(eq(planCourses.id, id))
    .limit(1);
  return result[0];
}

export async function createPlanCourse(data: {
  semesterId: number;
  courseId: number;
  status?:
    | "planned"
    | "enrolled"
    | "completed"
    | "dropped"
    | "failed"
    | "waived";
  notes?: string;
}) {
  const db = await getDb();
  if (!db) {
    memory.planCourses.push({
      id: nextId(),
      status: data.status ?? "planned",
      grade: null,
      isSubstitution: false,
      substituteForCourseId: null,
      notes: null,
      ...data,
    });
    return;
  }
  await db.insert(planCourses).values(data as any);
}

export async function movePlanCourse(id: number, semesterId: number) {
  const db = await getDb();
  if (!db) {
    const course = memory.planCourses.find(pc => pc.id === id);
    if (course) course.semesterId = semesterId;
    return;
  }
  await db
    .update(planCourses)
    .set({ semesterId } as any)
    .where(eq(planCourses.id, id));
}

export async function updatePlanCourseStatus(
  id: number,
  status:
    | "planned"
    | "enrolled"
    | "completed"
    | "dropped"
    | "failed"
    | "waived",
  grade?: string
) {
  const db = await getDb();
  if (!db) {
    const course = memory.planCourses.find(pc => pc.id === id);
    if (course) Object.assign(course, { status, grade });
    return;
  }
  await db
    .update(planCourses)
    .set({ status, grade } as any)
    .where(eq(planCourses.id, id));
}

// ─── Scenario Simulations ─────────────────────────────────────────────────────
export async function getScenariosByUser(userId: number) {
  const db = await getDb();
  if (!db) return memory.scenarios.filter(s => s.userId === userId);
  return db
    .select()
    .from(scenarioSimulations)
    .where(eq(scenarioSimulations.userId, userId));
}

export async function createScenarioSimulation(data: {
  userId: number;
  basePlanId: number;
  name: string;
  scenarioType:
    | "drop_course"
    | "add_major"
    | "change_graduation"
    | "fail_course"
    | "add_minor"
    | "custom";
  parametersJson: string;
  resultPlanDataJson?: string;
  impactSummary?: string;
}) {
  const db = await getDb();
  if (!db) {
    const id = nextId();
    memory.scenarios.push({ id, createdAt: now(), ...data });
    return id;
  }
  const result = await db.insert(scenarioSimulations).values(data as any);
  return (result as any)[0]?.insertId as number;
}

// ─── Chat Messages ────────────────────────────────────────────────────────────
export async function getChatMessagesByUser(userId: number, planId?: number) {
  const db = await getDb();
  if (!db) {
    return memory.chatMessages.filter(
      m => m.userId === userId && (!planId || m.planId === planId)
    );
  }
  if (planId) {
    return db
      .select()
      .from(chatMessages)
      .where(
        and(eq(chatMessages.userId, userId), eq(chatMessages.planId, planId))
      );
  }
  return db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
}

export async function createChatMessage(data: {
  userId: number;
  planId?: number;
  role: "user" | "assistant";
  content: string;
}) {
  const db = await getDb();
  if (!db) {
    memory.chatMessages.push({ id: nextId(), createdAt: now(), ...data });
    return;
  }
  await db.insert(chatMessages).values(data as any);
}

// ─── Account Management ───────────────────────────────────────────────────────

/**
 * Reset a user's academic data: deletes all plan_courses, plan_semesters,
 * degree_plans, scenario_simulations, chat_messages, and the student_profile.
 * The user record itself is preserved so the user can log back in and start fresh.
 */
export async function resetUserData(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    const planIds = memory.plans
      .filter(p => p.userId === userId)
      .map(p => p.id);
    const semesterIds = memory.semesters
      .filter(s => planIds.includes(s.planId))
      .map(s => s.id);
    memory.planCourses = memory.planCourses.filter(
      pc => !semesterIds.includes(pc.semesterId)
    );
    memory.semesters = memory.semesters.filter(
      s => !planIds.includes(s.planId)
    );
    memory.plans = memory.plans.filter(p => p.userId !== userId);
    memory.scenarios = memory.scenarios.filter(s => s.userId !== userId);
    memory.chatMessages = memory.chatMessages.filter(m => m.userId !== userId);
    memory.profiles = memory.profiles.filter(p => p.userId !== userId);
    return;
  }

  // 1. Get all plan IDs for this user
  const userPlans = await db
    .select({ id: degreePlans.id })
    .from(degreePlans)
    .where(eq(degreePlans.userId, userId));
  const planIds = userPlans.map(p => p.id);

  // 2. For each plan, delete plan_courses then plan_semesters
  for (const planId of planIds) {
    const semesters = await db
      .select({ id: planSemesters.id })
      .from(planSemesters)
      .where(eq(planSemesters.planId, planId));
    for (const sem of semesters) {
      await db.delete(planCourses).where(eq(planCourses.semesterId, sem.id));
    }
    await db.delete(planSemesters).where(eq(planSemesters.planId, planId));
  }

  // 3. Delete degree_plans
  if (planIds.length > 0) {
    await db.delete(degreePlans).where(eq(degreePlans.userId, userId));
  }

  // 4. Delete scenario_simulations
  await db
    .delete(scenarioSimulations)
    .where(eq(scenarioSimulations.userId, userId));

  // 5. Delete chat_messages
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));

  // 6. Delete student_profile
  await db.delete(studentProfiles).where(eq(studentProfiles.userId, userId));
}

/**
 * Permanently delete a user account and all associated data.
 * Calls resetUserData first, then removes the user record itself.
 */
export async function deleteUserAccount(userId: number): Promise<void> {
  await resetUserData(userId);
  const db = await getDb();
  if (!db) {
    memory.users = memory.users.filter(u => u.id !== userId);
    return;
  }
  await db.delete(users).where(eq(users.id, userId));
}

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

dotenv.config();

const UMICH_SCHOOL_ID = 2;
const UMICH_PROGRAM_SOURCE =
  "Catalog entry from official University of Michigan undergraduate admissions/LSA program lists. Requirement-level course planning is not yet ingested.";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run(sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result;
}

function readUmichCatalog() {
  const source = readFileSync(
    new URL("../../server/data/schools/umich.ts", import.meta.url),
    "utf8"
  );
  const readArray = name => {
    const match = source.match(
      new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]) as const;`)
    );
    if (!match)
      throw new Error(`Unable to find ${name} in server/data/schools/umich.ts`);
    return Function(`"use strict"; return ${match[1]};`)();
  };

  return {
    majors: readArray("umichMajors"),
    minors: readArray("umichMinors"),
  };
}

const shortName = name => (name.length > 64 ? `${name.slice(0, 61)}...` : name);

const subjectOverrides = {
  "Actuarial Mathematics": "ACTM",
  "Aerospace Engineering": "AERO",
  "African American and African Studies": "AAS",
  "Afroamerican and African Studies": "AAS",
  Anthropology: "ANTH",
  Architecture: "ARCH",
  "Artificial Intelligence": "AI",
  "Astronomy and Astrophysics": "ASTRO",
  Biochemistry: "BIOCH",
  Biology: "BIO",
  "Biomedical Engineering": "BME",
  Business: "BUS",
  "Chemical Engineering": "CHE",
  Chemistry: "CHEM",
  "Civil Engineering": "CEE",
  "Classical Civilization": "CLCV",
  "Cognitive Science": "COGSCI",
  "Communication and Media": "COMM",
  "Computer Engineering": "CENG",
  "Computer Science": "CS",
  "Computer Science (BS)": "CS",
  "Computer Science (BSE)": "CS",
  "Data Science": "DATASCI",
  "Data Science (BS)": "DATASCI",
  Economics: "ECON",
  Education: "EDUC",
  "Electrical Engineering": "EE",
  English: "ENGL",
  Environment: "ENVIRON",
  "Environmental Engineering": "ENVENG",
  German: "GERMAN",
  History: "HIST",
  "History of Art": "HISTART",
  "Industrial and Operations Engineering": "IOE",
  "Information Science": "INFO",
  "International Studies": "INTLSTD",
  Linguistics: "LING",
  Mathematics: "MATH",
  "Materials Science and Engineering": "MATSCIE",
  "Mechanical Engineering": "MECHENG",
  Microbiology: "MICRBIOL",
  Neuroscience: "NEURO",
  Nursing: "NURS",
  Philosophy: "PHIL",
  Physics: "PHYSICS",
  "Political Science": "POLSCI",
  Psychology: "PSYCH",
  "Public Health Sciences": "PUBHLTH",
  "Public Policy": "PUBPOL",
  Robotics: "ROB",
  Sociology: "SOC",
  Spanish: "SPANISH",
  Statistics: "STATS",
  Writing: "WRITING",
};

const normalizeProgramName = name =>
  name
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, "and")
    .replace(/['']/g, "")
    .trim();

function toSubjectCode(name) {
  const normalized = normalizeProgramName(name);
  if (subjectOverrides[normalized]) return subjectOverrides[normalized];

  const words = normalized.match(/[A-Za-z]+/g) ?? ["UM"];
  const initials = words
    .filter(
      word =>
        !["and", "of", "the", "in", "for", "to", "with"].includes(
          word.toLowerCase()
        )
    )
    .map(word => word[0])
    .join("");
  return (initials || words[0]).toUpperCase().slice(0, 8);
}

const toTags = (name, type) =>
  JSON.stringify([
    "umich",
    type,
    ...normalizeProgramName(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .slice(0, 4),
  ]);

function toCareerTracks(name) {
  const lower = name.toLowerCase();
  const tracks = new Set();

  if (
    /(computer|software|data|artificial intelligence|robotics|information|statistics|mathematics)/.test(
      lower
    )
  ) {
    tracks.add("software_engineering");
    tracks.add("data_science");
  }
  if (
    /(business|economics|finance|accounting|actuarial|marketing|management|policy)/.test(
      lower
    )
  ) {
    tracks.add("finance");
    tracks.add("consulting");
  }
  if (
    /(biology|biomedical|biochemistry|nursing|neuroscience|health|pharmaceutical|microbiology|dental)/.test(
      lower
    )
  ) {
    tracks.add("healthcare");
    tracks.add("grad_school");
  }
  if (
    /(engineering|architecture|physics|chemistry|materials|aerospace|mechanical|electrical|civil|nuclear)/.test(
      lower
    )
  ) {
    tracks.add("engineering");
    tracks.add("grad_school");
  }
  if (
    /(education|teaching|psychology|sociology|anthropology|public health)/.test(
      lower
    )
  ) {
    tracks.add("public_service");
    tracks.add("grad_school");
  }
  if (tracks.size === 0) tracks.add("grad_school");

  return JSON.stringify(Array.from(tracks));
}

const majorCoursePlan = [
  [1, 100, "Foundations I", 4],
  [2, 100, "Foundations II", 4],
  [3, 200, "Methods and Analysis", 4],
  [4, 200, "Practice Lab", 4],
  [5, 300, "Advanced Topics I", 4],
  [6, 300, "Advanced Topics II", 4],
  [7, 300, "Research Seminar", 3],
  [8, 400, "Professional Practice", 3],
  [9, 400, "Capstone Studio", 4],
];

const minorCoursePlan = [
  [1, 100, "Foundations", 3],
  [2, 200, "Methods", 3],
  [3, 300, "Applied Topics", 3],
  [4, 300, "Elective Seminar", 3],
  [5, 400, "Integrative Project", 3],
];

const majorCategoryPlan = [
  [
    "Foundational Coursework",
    "core",
    8,
    2,
    "Introductory coursework for the program.",
    [1, 2],
  ],
  [
    "Methods and Practice",
    "core",
    8,
    2,
    "Methods, practice, and disciplinary tools.",
    [3, 4],
  ],
  [
    "Advanced Requirements",
    "elective",
    11,
    3,
    "Upper-level program requirements.",
    [5, 6, 7],
  ],
  [
    "Capstone",
    "capstone",
    7,
    2,
    "Advanced practice and integrative capstone.",
    [8, 9],
  ],
];

const minorCategoryPlan = [
  ["Minor Core", "core", 6, 2, "Foundational minor coursework.", [1, 2]],
  [
    "Minor Electives and Project",
    "elective",
    9,
    3,
    "Applied minor electives and integrative project.",
    [3, 4, 5],
  ],
];

function makeProgramRows({ majors, minors }) {
  return [
    ...majors.map((name, index) => ({
      id: 2000 + index,
      schoolId: UMICH_SCHOOL_ID,
      name,
      shortName: shortName(name),
      type: "major",
      totalCreditsRequired: 120,
      description: UMICH_PROGRAM_SOURCE,
    })),
    ...minors.map((name, index) => ({
      id: 3000 + index,
      schoolId: UMICH_SCHOOL_ID,
      name,
      shortName: shortName(name),
      type: "minor",
      totalCreditsRequired: 15,
      description: UMICH_PROGRAM_SOURCE,
    })),
  ];
}

function makeCourse(program, index, level, title, credits) {
  const subject = toSubjectCode(program.name);
  const courseNumber = level + index;

  return [
    program.id * 100 + index,
    UMICH_SCHOOL_ID,
    `${subject} ${courseNumber}`,
    `${normalizeProgramName(program.name)} ${title}`,
    `${title} for the University of Michigan ${program.name} ${program.type}. Advisor verification is recommended before final registration.`,
    credits,
    Math.min(5, Math.max(2, Math.floor(level / 100))),
    credits * (level >= 400 ? 4 : level >= 300 ? 3.5 : 3),
    1,
    1,
    level < 400 ? 1 : 0,
    level >= 300 ? 1 : 0,
    toTags(program.name, program.type),
    toCareerTracks(program.name),
  ];
}

function buildUmichRows(programs) {
  const courses = [];
  const prerequisites = [];
  const categories = [];
  const requirements = [];

  for (const program of programs) {
    const coursePlan =
      program.type === "major" ? majorCoursePlan : minorCoursePlan;
    const categoryPlan =
      program.type === "major" ? majorCategoryPlan : minorCategoryPlan;
    const courseIds = coursePlan.map(([index]) => program.id * 100 + index);

    for (const [index, level, title, credits] of coursePlan) {
      courses.push(makeCourse(program, index, level, title, credits));
    }

    for (let index = 1; index < courseIds.length; index += 1) {
      prerequisites.push([
        program.id * 100 + index,
        courseIds[index],
        courseIds[index - 1],
        "required",
        "D",
      ]);
    }

    let requirementOffset = 0;
    categoryPlan.forEach(
      (
        [
          name,
          type,
          creditsRequired,
          coursesRequired,
          description,
          courseIndexes,
        ],
        categoryIndex
      ) => {
        const categoryId = program.id * 10 + categoryIndex + 1;
        categories.push([
          categoryId,
          program.id,
          name,
          type,
          creditsRequired,
          coursesRequired,
          `${description} Generated catalog coverage for University of Michigan ${program.name}.`,
          categoryIndex + 1,
        ]);

        for (const courseIndex of courseIndexes) {
          requirementOffset += 1;
          requirements.push([
            program.id * 100 + requirementOffset,
            categoryId,
            program.id * 100 + courseIndex,
            1,
            "[]",
            "Representative generated requirement. Verify exact U-M catalog rules with an advisor or official department page.",
          ]);
        }
      }
    );
  }

  return { courses, prerequisites, categories, requirements };
}

console.log("Seeding University of Michigan catalog tables...");

const catalog = readUmichCatalog();
const programs = makeProgramRows(catalog);
const { courses, prerequisites, categories, requirements } =
  buildUmichRows(programs);
const programIds = programs.map(program => program.id);
const courseIds = courses.map(course => course[0]);
const categoryIds = categories.map(category => category[0]);

await run(
  `INSERT INTO schools (id, name, shortName, location, semesterSystem, maxCreditsPerSemester, minCreditsPerSemester)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE name=VALUES(name), shortName=VALUES(shortName), location=VALUES(location), semesterSystem=VALUES(semesterSystem), maxCreditsPerSemester=VALUES(maxCreditsPerSemester), minCreditsPerSemester=VALUES(minCreditsPerSemester)`,
  [
    UMICH_SCHOOL_ID,
    "University of Michigan",
    "U-M",
    "Ann Arbor, MI",
    "semester",
    18,
    12,
  ]
);

await run(
  `DELETE FROM degree_requirements WHERE categoryId IN (${categoryIds.map(() => "?").join(",")})`,
  categoryIds
);
await run(
  `DELETE FROM requirement_categories WHERE programId IN (${programIds.map(() => "?").join(",")})`,
  programIds
);
await run(
  `DELETE FROM prerequisites WHERE courseId IN (${courseIds.map(() => "?").join(",")})`,
  courseIds
);
await run(`DELETE FROM courses WHERE schoolId = ?`, [UMICH_SCHOOL_ID]);
await run(`DELETE FROM programs WHERE schoolId = ?`, [UMICH_SCHOOL_ID]);

for (const program of programs) {
  await run(
    `INSERT INTO programs (id, schoolId, name, shortName, type, totalCreditsRequired, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      program.id,
      program.schoolId,
      program.name,
      program.shortName,
      program.type,
      program.totalCreditsRequired,
      program.description,
    ]
  );
}

for (const course of courses) {
  await run(
    `INSERT INTO courses (id, schoolId, code, name, description, credits, difficultyLevel, workloadHours, availableFall, availableSpring, availableSummer, isUpperDivision, tagsJson, careerTracksJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    course
  );
}

for (const prereq of prerequisites) {
  await run(
    `INSERT INTO prerequisites (id, courseId, prerequisiteCourseId, type, minimumGrade) VALUES (?, ?, ?, ?, ?)`,
    prereq
  );
}

for (const category of categories) {
  await run(
    `INSERT INTO requirement_categories (id, programId, name, type, creditsRequired, coursesRequired, description, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    category
  );
}

for (const requirement of requirements) {
  await run(
    `INSERT INTO degree_requirements (id, categoryId, courseId, isRequired, alternativeCourseIdsJson, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    requirement
  );
}

console.log(
  `Done: ${programs.length} programs, ${courses.length} courses, ${prerequisites.length} prerequisites, ${categories.length} categories, ${requirements.length} degree requirements.`
);

await conn.end();

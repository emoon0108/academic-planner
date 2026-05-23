import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run(sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result;
}

function readMsuCatalog() {
  const source = readFileSync(
    new URL("../../server/data/schools/msu.ts", import.meta.url),
    "utf8"
  );
  const readArray = name => {
    const match = source.match(
      new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]) as const;`)
    );
    if (!match)
      throw new Error(`Unable to find ${name} in server/data/schools/msu.ts`);
    return Function(`"use strict"; return ${match[1]};`)();
  };

  return {
    majors: readArray("msuMajors"),
    minors: readArray("msuMinors"),
    economicsCourses: readArray("msuEconomicsCourseCatalog"),
  };
}

const shortName = name => (name.length > 64 ? `${name.slice(0, 61)}...` : name);

console.log("🌱 Seeding AcademiQ database...\n");

// ─── Schools ─────────────────────────────────────────────────────────────────
console.log("Seeding schools...");
await run(`DELETE FROM schools`);
await run(`INSERT INTO schools (id, name, shortName, location, semesterSystem, maxCreditsPerSemester, minCreditsPerSemester) VALUES
  (1, 'State University of Technology', 'SUT', 'Austin, TX', 'semester', 18, 12),
  (2, 'Westbrook College of Arts & Sciences', 'WCAS', 'Boston, MA', 'semester', 20, 12),
  (3, 'Michigan State University', 'MSU', 'East Lansing, MI', 'semester', 18, 12)`);

// ─── Programs ─────────────────────────────────────────────────────────────────
console.log("Seeding programs...");
await run(`DELETE FROM programs`);
await run(`INSERT INTO programs (id, schoolId, name, shortName, type, totalCreditsRequired, description) VALUES
  (1, 1, 'Computer Science', 'CS', 'major', 120, 'Bachelor of Science in Computer Science with focus on algorithms, systems, and software engineering'),
  (2, 1, 'Business Administration', 'BUS', 'major', 120, 'Bachelor of Science in Business Administration covering management, finance, and marketing'),
  (3, 1, 'Psychology', 'PSY', 'major', 120, 'Bachelor of Science in Psychology covering human behavior, cognition, and research methods'),
  (4, 1, 'Data Science', 'DS', 'minor', 18, 'Minor in Data Science covering statistics, machine learning, and data visualization'),
  (5, 1, 'Mathematics', 'MATH', 'minor', 18, 'Minor in Mathematics covering calculus, linear algebra, and discrete mathematics'),
  (6, 2, 'Computer Science', 'CS', 'major', 128, 'Bachelor of Science in Computer Science at Westbrook'),
  (7, 2, 'Economics', 'ECON', 'major', 120, 'Bachelor of Arts in Economics at Westbrook')`);

const msuCatalog = readMsuCatalog();
const msuProgramSource =
  "Catalog entry for Michigan State University. Requirement-level course planning is not yet ingested.";
for (const [index, name] of msuCatalog.majors.entries()) {
  await run(
    `INSERT INTO programs (id, schoolId, name, shortName, type, totalCreditsRequired, description) VALUES (?, 3, ?, ?, 'major', 120, ?)`,
    [4000 + index, name, shortName(name), msuProgramSource]
  );
}
for (const [index, name] of msuCatalog.minors.entries()) {
  await run(
    `INSERT INTO programs (id, schoolId, name, shortName, type, totalCreditsRequired, description) VALUES (?, 3, ?, ?, 'minor', 15, ?)`,
    [5000 + index, name, shortName(name), msuProgramSource]
  );
}

// ─── Courses (School 1 - SUT) ─────────────────────────────────────────────────
console.log("Seeding courses...");
await run(`DELETE FROM courses`);

// CS Core Courses
const csCourses = [
  // Freshman
  [
    1,
    1,
    "CS 101",
    "Introduction to Computer Science",
    "Fundamentals of programming using Python. Variables, control flow, functions, and basic data structures.",
    3,
    1,
    6,
    1,
    1,
    0,
    0,
    '["programming","python","intro"]',
    '["software_engineering","data_science"]',
  ],
  [
    2,
    1,
    "CS 102",
    "Data Structures and Algorithms I",
    "Arrays, linked lists, stacks, queues, and basic sorting algorithms.",
    3,
    2,
    8,
    1,
    1,
    0,
    0,
    '["data-structures","algorithms"]',
    '["software_engineering","systems"]',
  ],
  [
    3,
    1,
    "MATH 101",
    "Calculus I",
    "Limits, derivatives, and integrals of single-variable functions.",
    4,
    3,
    10,
    1,
    1,
    1,
    0,
    '["calculus","math"]',
    '["data_science","quantitative_finance"]',
  ],
  [
    4,
    1,
    "MATH 102",
    "Calculus II",
    "Integration techniques, sequences, series, and multivariable introduction.",
    4,
    3,
    10,
    1,
    1,
    0,
    0,
    '["calculus","math"]',
    '["data_science","quantitative_finance"]',
  ],
  [
    5,
    1,
    "MATH 201",
    "Discrete Mathematics",
    "Logic, sets, relations, graph theory, and combinatorics.",
    3,
    3,
    9,
    1,
    1,
    0,
    0,
    '["discrete-math","logic"]',
    '["software_engineering","systems"]',
  ],
  [
    6,
    1,
    "CS 201",
    "Data Structures and Algorithms II",
    "Trees, heaps, hash tables, graphs, and advanced sorting.",
    3,
    3,
    10,
    1,
    1,
    0,
    0,
    '["data-structures","algorithms","graphs"]',
    '["software_engineering","systems"]',
  ],
  // Sophomore
  [
    7,
    1,
    "CS 211",
    "Computer Organization",
    "Digital logic, assembly language, memory hierarchy, and CPU architecture.",
    3,
    4,
    11,
    1,
    1,
    0,
    0,
    '["systems","architecture"]',
    '["systems","embedded"]',
  ],
  [
    8,
    1,
    "CS 221",
    "Object-Oriented Programming",
    "OOP principles, design patterns, Java programming.",
    3,
    2,
    8,
    1,
    1,
    0,
    0,
    '["oop","java","design-patterns"]',
    '["software_engineering"]',
  ],
  [
    9,
    1,
    "MATH 301",
    "Linear Algebra",
    "Vectors, matrices, linear transformations, eigenvalues.",
    3,
    3,
    9,
    1,
    1,
    0,
    0,
    '["linear-algebra","math"]',
    '["data_science","machine_learning"]',
  ],
  [
    10,
    1,
    "MATH 302",
    "Probability and Statistics",
    "Probability theory, distributions, hypothesis testing.",
    3,
    3,
    9,
    1,
    1,
    0,
    0,
    '["probability","statistics"]',
    '["data_science","machine_learning","quantitative_finance"]',
  ],
  [
    11,
    1,
    "CS 231",
    "Operating Systems",
    "Processes, threads, memory management, file systems.",
    3,
    4,
    12,
    1,
    1,
    0,
    1,
    '["os","systems","concurrency"]',
    '["systems","cloud_computing"]',
  ],
  [
    12,
    1,
    "CS 241",
    "Database Systems",
    "Relational model, SQL, normalization, transaction processing.",
    3,
    3,
    9,
    1,
    1,
    0,
    1,
    '["databases","sql"]',
    '["software_engineering","data_science"]',
  ],
  // Junior
  [
    13,
    1,
    "CS 311",
    "Algorithms and Complexity",
    "Algorithm design, NP-completeness, approximation algorithms.",
    3,
    5,
    14,
    1,
    1,
    0,
    1,
    '["algorithms","complexity","theory"]',
    '["software_engineering","systems"]',
  ],
  [
    14,
    1,
    "CS 321",
    "Software Engineering",
    "Software lifecycle, agile methods, testing, version control.",
    3,
    3,
    9,
    1,
    1,
    0,
    1,
    '["software-engineering","agile","testing"]',
    '["software_engineering"]',
  ],
  [
    15,
    1,
    "CS 331",
    "Computer Networks",
    "Network protocols, TCP/IP, routing, security fundamentals.",
    3,
    3,
    10,
    1,
    1,
    0,
    1,
    '["networks","protocols","security"]',
    '["systems","cloud_computing","cybersecurity"]',
  ],
  [
    16,
    1,
    "CS 341",
    "Artificial Intelligence",
    "Search, knowledge representation, machine learning basics.",
    3,
    4,
    12,
    1,
    0,
    0,
    1,
    '["ai","machine-learning","search"]',
    '["machine_learning","data_science"]',
  ],
  [
    17,
    1,
    "CS 351",
    "Programming Languages",
    "Language paradigms, compilers, type systems, semantics.",
    3,
    4,
    11,
    0,
    1,
    0,
    1,
    '["programming-languages","compilers"]',
    '["software_engineering","systems"]',
  ],
  [
    18,
    1,
    "CS 361",
    "Computer Security",
    "Cryptography, network security, secure coding, vulnerabilities.",
    3,
    4,
    11,
    1,
    1,
    0,
    1,
    '["security","cryptography","networking"]',
    '["cybersecurity"]',
  ],
  // Senior
  [
    19,
    1,
    "CS 411",
    "Machine Learning",
    "Supervised/unsupervised learning, neural networks, evaluation.",
    3,
    5,
    14,
    1,
    1,
    0,
    1,
    '["machine-learning","neural-networks","deep-learning"]',
    '["machine_learning","data_science"]',
  ],
  [
    20,
    1,
    "CS 421",
    "Distributed Systems",
    "Consistency, replication, fault tolerance, cloud architectures.",
    3,
    5,
    13,
    1,
    0,
    0,
    1,
    '["distributed","cloud","scalability"]',
    '["systems","cloud_computing"]',
  ],
  [
    21,
    1,
    "CS 431",
    "Computer Graphics",
    "Rendering, shading, transformations, OpenGL.",
    3,
    4,
    11,
    0,
    1,
    0,
    1,
    '["graphics","rendering","opengl"]',
    '["game_development"]',
  ],
  [
    22,
    1,
    "CS 441",
    "Senior Capstone I",
    "First semester of year-long senior project. Team-based software development.",
    3,
    3,
    10,
    1,
    0,
    0,
    1,
    '["capstone","project","teamwork"]',
    '["software_engineering"]',
  ],
  [
    23,
    1,
    "CS 442",
    "Senior Capstone II",
    "Completion and presentation of senior capstone project.",
    3,
    3,
    10,
    0,
    1,
    0,
    1,
    '["capstone","project","presentation"]',
    '["software_engineering"]',
  ],
  [
    24,
    1,
    "CS 451",
    "Deep Learning",
    "CNNs, RNNs, transformers, and modern deep learning architectures.",
    3,
    5,
    14,
    1,
    1,
    0,
    1,
    '["deep-learning","cnn","transformers"]',
    '["machine_learning"]',
  ],
  [
    25,
    1,
    "CS 461",
    "Cloud Computing",
    "AWS/GCP/Azure, containerization, microservices, DevOps.",
    3,
    4,
    12,
    1,
    1,
    0,
    1,
    '["cloud","devops","containers"]',
    '["cloud_computing","systems"]',
  ],
  // General Education
  [
    26,
    1,
    "ENG 101",
    "English Composition I",
    "Academic writing, argumentation, and research skills.",
    3,
    1,
    5,
    1,
    1,
    1,
    0,
    '["writing","composition"]',
    "[]",
  ],
  [
    27,
    1,
    "ENG 102",
    "English Composition II",
    "Advanced academic writing and research methods.",
    3,
    1,
    5,
    1,
    1,
    0,
    0,
    '["writing","research"]',
    "[]",
  ],
  [
    28,
    1,
    "HIST 101",
    "World History I",
    "Survey of world history from ancient civilizations to 1500.",
    3,
    1,
    4,
    1,
    1,
    0,
    0,
    '["history","humanities"]',
    "[]",
  ],
  [
    29,
    1,
    "PHIL 201",
    "Ethics and Society",
    "Ethical theories and their application to contemporary issues.",
    3,
    2,
    5,
    1,
    1,
    0,
    0,
    '["ethics","philosophy","humanities"]',
    "[]",
  ],
  [
    30,
    1,
    "COMM 101",
    "Public Speaking",
    "Oral communication, presentation skills, and persuasion.",
    3,
    1,
    4,
    1,
    1,
    0,
    0,
    '["communication","speaking"]',
    "[]",
  ],
  // Business Courses
  [
    31,
    1,
    "BUS 101",
    "Introduction to Business",
    "Overview of business functions, markets, and organizations.",
    3,
    1,
    5,
    1,
    1,
    0,
    0,
    '["business","management"]',
    '["business_management","entrepreneurship"]',
  ],
  [
    32,
    1,
    "BUS 201",
    "Principles of Accounting I",
    "Financial accounting, balance sheets, income statements.",
    3,
    2,
    8,
    1,
    1,
    0,
    0,
    '["accounting","finance"]',
    '["quantitative_finance","business_management"]',
  ],
  [
    33,
    1,
    "BUS 202",
    "Principles of Accounting II",
    "Managerial accounting, cost analysis, budgeting.",
    3,
    2,
    8,
    1,
    1,
    0,
    0,
    '["accounting","managerial"]',
    '["quantitative_finance","business_management"]',
  ],
  [
    34,
    1,
    "BUS 211",
    "Microeconomics",
    "Supply and demand, market structures, consumer theory.",
    3,
    2,
    7,
    1,
    1,
    0,
    0,
    '["economics","microeconomics"]',
    '["quantitative_finance","business_management"]',
  ],
  [
    35,
    1,
    "BUS 212",
    "Macroeconomics",
    "GDP, inflation, monetary policy, fiscal policy.",
    3,
    2,
    7,
    1,
    1,
    0,
    0,
    '["economics","macroeconomics"]',
    '["quantitative_finance"]',
  ],
  [
    36,
    1,
    "BUS 301",
    "Corporate Finance",
    "Capital structure, valuation, investment decisions.",
    3,
    4,
    11,
    1,
    1,
    0,
    1,
    '["finance","valuation","corporate"]',
    '["quantitative_finance","business_management"]',
  ],
  [
    37,
    1,
    "BUS 311",
    "Marketing Management",
    "Marketing strategy, consumer behavior, brand management.",
    3,
    2,
    7,
    1,
    1,
    0,
    1,
    '["marketing","strategy","branding"]',
    '["business_management","entrepreneurship"]',
  ],
  [
    38,
    1,
    "BUS 321",
    "Operations Management",
    "Supply chain, logistics, process optimization.",
    3,
    3,
    9,
    1,
    1,
    0,
    1,
    '["operations","supply-chain","logistics"]',
    '["business_management"]',
  ],
  [
    39,
    1,
    "BUS 331",
    "Organizational Behavior",
    "Leadership, motivation, team dynamics, organizational culture.",
    3,
    2,
    7,
    1,
    1,
    0,
    1,
    '["leadership","management","organizational"]',
    '["business_management"]',
  ],
  [
    40,
    1,
    "BUS 401",
    "Strategic Management",
    "Competitive strategy, business models, industry analysis.",
    3,
    4,
    10,
    1,
    1,
    0,
    1,
    '["strategy","competitive","business-model"]',
    '["business_management","entrepreneurship"]',
  ],
  [
    41,
    1,
    "BUS 411",
    "Business Analytics",
    "Data-driven decision making, statistical analysis, visualization.",
    3,
    3,
    10,
    1,
    1,
    0,
    1,
    '["analytics","data","decision-making"]',
    '["data_science","business_management"]',
  ],
  [
    42,
    1,
    "BUS 421",
    "Entrepreneurship",
    "Startup creation, business planning, venture funding.",
    3,
    2,
    8,
    1,
    1,
    0,
    1,
    '["entrepreneurship","startup","venture"]',
    '["entrepreneurship"]',
  ],
  [
    43,
    1,
    "BUS 431",
    "Business Capstone",
    "Integrative business strategy project and presentation.",
    3,
    3,
    10,
    1,
    1,
    0,
    1,
    '["capstone","strategy","project"]',
    '["business_management"]',
  ],
  // Psychology Courses
  [
    44,
    1,
    "PSY 101",
    "Introduction to Psychology",
    "Overview of psychology: behavior, cognition, development.",
    3,
    1,
    5,
    1,
    1,
    0,
    0,
    '["psychology","behavior","cognition"]',
    "[]",
  ],
  [
    45,
    1,
    "PSY 201",
    "Research Methods in Psychology",
    "Experimental design, data collection, statistical analysis.",
    3,
    3,
    9,
    1,
    1,
    0,
    0,
    '["research","statistics","methodology"]',
    "[]",
  ],
  [
    46,
    1,
    "PSY 211",
    "Cognitive Psychology",
    "Memory, attention, language, problem solving, decision making.",
    3,
    3,
    8,
    1,
    1,
    0,
    1,
    '["cognition","memory","attention"]',
    "[]",
  ],
  [
    47,
    1,
    "PSY 221",
    "Abnormal Psychology",
    "Psychological disorders, diagnosis, treatment approaches.",
    3,
    3,
    8,
    0,
    1,
    0,
    1,
    '["abnormal","disorders","clinical"]',
    "[]",
  ],
  [
    48,
    1,
    "PSY 301",
    "Social Psychology",
    "Social influence, attitudes, group dynamics, prejudice.",
    3,
    3,
    8,
    1,
    1,
    0,
    1,
    '["social","group-dynamics","attitudes"]',
    "[]",
  ],
  [
    49,
    1,
    "PSY 311",
    "Developmental Psychology",
    "Human development from infancy through adulthood.",
    3,
    2,
    7,
    1,
    0,
    0,
    1,
    '["development","lifespan","cognition"]',
    "[]",
  ],
  [
    50,
    1,
    "PSY 401",
    "Neuroscience",
    "Brain structure, neural communication, behavior and cognition.",
    3,
    4,
    11,
    1,
    1,
    0,
    1,
    '["neuroscience","brain","neural"]',
    "[]",
  ],
  [
    51,
    1,
    "PSY 411",
    "Psychology Capstone",
    "Research thesis or applied project in psychology.",
    3,
    3,
    10,
    1,
    1,
    0,
    1,
    '["capstone","research","thesis"]',
    "[]",
  ],
  // Data Science Minor Courses
  [
    52,
    1,
    "DS 201",
    "Introduction to Data Science",
    "Data wrangling, visualization, and exploratory analysis with Python.",
    3,
    2,
    8,
    1,
    1,
    0,
    0,
    '["data-science","python","visualization"]',
    '["data_science","machine_learning"]',
  ],
  [
    53,
    1,
    "DS 301",
    "Statistical Learning",
    "Regression, classification, model selection, cross-validation.",
    3,
    4,
    12,
    1,
    1,
    0,
    1,
    '["statistics","machine-learning","modeling"]',
    '["data_science","machine_learning"]',
  ],
  [
    54,
    1,
    "DS 401",
    "Big Data Engineering",
    "Hadoop, Spark, data pipelines, and distributed data processing.",
    3,
    4,
    12,
    1,
    1,
    0,
    1,
    '["big-data","spark","hadoop","pipelines"]',
    '["data_science","cloud_computing"]',
  ],
];

for (const c of csCourses) {
  await run(
    `INSERT INTO courses (id, schoolId, code, name, description, credits, difficultyLevel, workloadHours, availableFall, availableSpring, availableSummer, isUpperDivision, tagsJson, careerTracksJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c
  );
}
for (const c of msuCatalog.economicsCourses) {
  await run(
    `INSERT INTO courses (id, schoolId, code, name, description, credits, difficultyLevel, workloadHours, availableFall, availableSpring, availableSummer, isUpperDivision, tagsJson, careerTracksJson) VALUES (?, 3, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?, ?)`,
    [
      c.id,
      c.code,
      c.name,
      `${c.name}, included for MSU Economics degree planning.`,
      c.credits,
      c.difficultyLevel,
      c.workloadHours,
      c.upper ? 1 : 0,
      JSON.stringify(c.tags),
      JSON.stringify(c.careers),
    ]
  );
}
console.log(
  `✓ Inserted ${csCourses.length + msuCatalog.economicsCourses.length} courses`
);

// ─── Prerequisites ────────────────────────────────────────────────────────────
console.log("Seeding prerequisites...");
await run(`DELETE FROM prerequisites`);

const prereqs = [
  // CS prereqs
  [1, 2, 1, "required"], // CS 102 requires CS 101
  [2, 6, 2, "required"], // CS 201 requires CS 102
  [3, 4, 3, "required"], // MATH 102 requires MATH 101
  [4, 9, 4, "required"], // Linear Algebra requires Calc II
  [5, 10, 3, "required"], // Prob & Stats requires Calc I
  [6, 5, 4, "required"], // Discrete Math requires Calc II
  [7, 7, 6, "required"], // Computer Org requires CS 201
  [8, 8, 1, "required"], // OOP requires CS 101
  [9, 11, 7, "required"], // OS requires Computer Org
  [10, 11, 6, "required"], // OS requires CS 201
  [11, 12, 6, "required"], // Databases requires CS 201
  [12, 13, 6, "required"], // Algorithms requires CS 201
  [13, 13, 5, "required"], // Algorithms requires Discrete Math
  [14, 14, 8, "required"], // Software Eng requires OOP
  [15, 15, 11, "required"], // Networks requires OS
  [16, 16, 6, "required"], // AI requires CS 201
  [17, 16, 10, "required"], // AI requires Prob & Stats
  [18, 17, 8, "required"], // Prog Languages requires OOP
  [19, 18, 15, "required"], // Security requires Networks
  [20, 19, 16, "required"], // ML requires AI
  [21, 19, 9, "required"], // ML requires Linear Algebra
  [22, 20, 11, "required"], // Distributed requires OS
  [23, 21, 7, "required"], // Graphics requires Computer Org
  [24, 22, 14, "required"], // Capstone I requires Software Eng
  [25, 23, 22, "required"], // Capstone II requires Capstone I
  [26, 24, 19, "required"], // Deep Learning requires ML
  [27, 25, 15, "required"], // Cloud Computing requires Networks
  // Business prereqs
  [28, 33, 32, "required"], // Accounting II requires Accounting I
  [29, 36, 32, "required"], // Corp Finance requires Accounting I
  [30, 36, 35, "required"], // Corp Finance requires Macroeconomics
  [31, 37, 31, "required"], // Marketing requires Intro to Business
  [32, 38, 31, "required"], // Operations requires Intro to Business
  [33, 39, 31, "required"], // Org Behavior requires Intro to Business
  [34, 40, 37, "required"], // Strategic Mgmt requires Marketing
  [35, 40, 36, "required"], // Strategic Mgmt requires Corp Finance
  [36, 41, 10, "required"], // Business Analytics requires Prob & Stats
  [37, 43, 40, "required"], // Business Capstone requires Strategic Mgmt
  // Psychology prereqs
  [38, 45, 44, "required"], // Research Methods requires Intro Psych
  [39, 46, 44, "required"], // Cognitive requires Intro Psych
  [40, 47, 44, "required"], // Abnormal requires Intro Psych
  [41, 48, 45, "required"], // Social Psych requires Research Methods
  [42, 49, 44, "required"], // Developmental requires Intro Psych
  [43, 50, 46, "required"], // Neuroscience requires Cognitive
  [44, 51, 45, "required"], // Capstone requires Research Methods
  // Data Science prereqs
  [45, 52, 1, "required"], // Intro DS requires CS 101
  [46, 53, 52, "required"], // Statistical Learning requires Intro DS
  [47, 53, 10, "required"], // Statistical Learning requires Prob & Stats
  [48, 54, 53, "required"], // Big Data requires Statistical Learning
  // ENG prereqs
  [49, 27, 26, "required"], // ENG 102 requires ENG 101
];

let pid = 1;
for (const [, courseId, prereqId, type] of prereqs) {
  await run(
    `INSERT INTO prerequisites (id, courseId, prerequisiteCourseId, type) VALUES (?, ?, ?, ?)`,
    [pid++, courseId, prereqId, type]
  );
}

const msuEconomicsPrereqs = [
  [6000, 6004, 6000, "required", "2.0"],
  [6001, 6005, 6001, "required", "2.0"],
  [6002, 6009, 6004, "required", "D"],
  [6003, 6010, 6005, "required", "D"],
  [6004, 6016, 6015, "required", "D"],
  [6005, 6033, 6031, "required", "D"],
  [6006, 6035, 6033, "required", "D"],
  [6007, 6039, 6031, "recommended", "D"],
];
for (const p of msuEconomicsPrereqs) {
  await run(
    `INSERT INTO prerequisites (id, courseId, prerequisiteCourseId, type, minimumGrade) VALUES (?, ?, ?, ?, ?)`,
    p
  );
}
console.log(
  `✓ Inserted ${prereqs.length + msuEconomicsPrereqs.length} prerequisites`
);

// ─── Requirement Categories ───────────────────────────────────────────────────
console.log("Seeding requirement categories...");
await run(`DELETE FROM requirement_categories`);

const categories = [
  // CS Major (programId=1)
  [
    1,
    1,
    "CS Core",
    "core",
    45,
    null,
    "Required core computer science courses",
    1,
  ],
  [2, 1, "Mathematics", "core", 16, null, "Required mathematics courses", 2],
  [
    3,
    1,
    "CS Electives",
    "elective",
    15,
    5,
    "Upper-division CS elective courses",
    3,
  ],
  [
    4,
    1,
    "General Education",
    "general_education",
    21,
    null,
    "General education requirements",
    4,
  ],
  [5, 1, "Senior Capstone", "capstone", 6, null, "Senior capstone project", 5],
  [
    6,
    1,
    "Free Electives",
    "free_elective",
    17,
    null,
    "Free elective credits",
    6,
  ],
  // Business Major (programId=2)
  [
    7,
    2,
    "Business Core",
    "core",
    42,
    null,
    "Required business core courses",
    1,
  ],
  [8, 2, "Economics", "core", 6, null, "Required economics courses", 2],
  [
    9,
    2,
    "Business Electives",
    "elective",
    15,
    5,
    "Upper-division business electives",
    3,
  ],
  [
    10,
    2,
    "General Education",
    "general_education",
    21,
    null,
    "General education requirements",
    4,
  ],
  [
    11,
    2,
    "Business Capstone",
    "capstone",
    3,
    null,
    "Business capstone project",
    5,
  ],
  [
    12,
    2,
    "Free Electives",
    "free_elective",
    33,
    null,
    "Free elective credits",
    6,
  ],
  // Psychology Major (programId=3)
  [
    13,
    3,
    "Psychology Core",
    "core",
    30,
    null,
    "Required psychology core courses",
    1,
  ],
  [
    14,
    3,
    "Psychology Electives",
    "elective",
    15,
    5,
    "Upper-division psychology electives",
    2,
  ],
  [
    15,
    3,
    "Research Methods",
    "core",
    6,
    null,
    "Research and statistics requirements",
    3,
  ],
  [
    16,
    3,
    "General Education",
    "general_education",
    21,
    null,
    "General education requirements",
    4,
  ],
  [
    17,
    3,
    "Psychology Capstone",
    "capstone",
    3,
    null,
    "Psychology capstone or thesis",
    5,
  ],
  [
    18,
    3,
    "Free Electives",
    "free_elective",
    45,
    null,
    "Free elective credits",
    6,
  ],
  // Data Science Minor (programId=4)
  [19, 4, "DS Core", "core", 9, null, "Required data science courses", 1],
  [20, 4, "DS Electives", "elective", 9, 3, "Data science elective courses", 2],
];

categories.push(
  [
    6000,
    4058,
    "Economics Core",
    "core",
    15,
    null,
    "Required Economics BA core courses.",
    1,
  ],
  [
    6001,
    4058,
    "International Economics Area",
    "elective",
    3,
    1,
    "Choose one approved international economics course.",
    2,
  ],
  [
    6002,
    4058,
    "Tier II Writing Economics Course",
    "core",
    3,
    1,
    "Choose one approved Economics writing course; cannot duplicate the international area.",
    3,
  ],
  [
    6003,
    4058,
    "Additional Economics Credits",
    "elective",
    9,
    3,
    "Nine additional Economics credits, including at least 6 credits at the 400 level.",
    4,
  ],
  [
    6004,
    4058,
    "Calculus",
    "core",
    3,
    1,
    "Choose one approved calculus course.",
    5,
  ],
  [
    6005,
    4058,
    "Statistics",
    "core",
    3,
    1,
    "Choose one approved statistics course.",
    6,
  ],
  [
    6006,
    4058,
    "Computing",
    "core",
    3,
    1,
    "Choose one approved computing course.",
    7,
  ],
  [
    6010,
    4059,
    "Economics Core",
    "core",
    15,
    null,
    "Required Economics BS core courses.",
    1,
  ],
  [
    6011,
    4059,
    "International Economics Area",
    "elective",
    3,
    1,
    "Choose one approved international economics course.",
    2,
  ],
  [
    6012,
    4059,
    "Tier II Writing Economics Course",
    "core",
    3,
    1,
    "Choose one approved Economics writing course; cannot duplicate the international area.",
    3,
  ],
  [
    6013,
    4059,
    "Advanced Economic Theory",
    "core",
    3,
    1,
    "Choose advanced microeconomics or advanced macroeconomics.",
    4,
  ],
  [
    6014,
    4059,
    "Advanced Econometrics or Seminar",
    "core",
    3,
    1,
    "Choose EC 421 or EC 499.",
    5,
  ],
  [
    6015,
    4059,
    "Additional Economics Credits",
    "elective",
    3,
    1,
    "Additional Economics 300-level or higher credit to reach at least 30 Economics credits.",
    6,
  ],
  [6016, 4059, "Calculus I", "core", 3, 1, "Choose MTH 132 or MTH 152H.", 7],
  [6017, 4059, "Calculus II", "core", 4, 1, "Choose MTH 133 or MTH 153H.", 8],
  [
    6018,
    4059,
    "Statistics",
    "core",
    3,
    1,
    "Choose one approved statistics course.",
    9,
  ],
  [
    6019,
    4059,
    "Math, Statistics, and Computing Electives",
    "elective",
    7,
    null,
    "Minimum 7 credits from approved quantitative/computing courses.",
    10,
  ],
  [
    6020,
    5042,
    "Economics Minor Core",
    "core",
    9,
    null,
    "Required Economics minor core courses.",
    1,
  ],
  [
    6021,
    5042,
    "Economics 400-Level Elective",
    "elective",
    3,
    1,
    "Complete 3 additional credits in Economics at the 400 level.",
    2,
  ],
  [
    6022,
    5042,
    "Additional Economics Electives",
    "elective",
    6,
    2,
    "Complete 6 additional Economics credits at the 300-400 level.",
    3,
  ]
);

for (const c of categories) {
  await run(
    `INSERT INTO requirement_categories (id, programId, name, type, creditsRequired, coursesRequired, description, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    c
  );
}
console.log(`✓ Inserted ${categories.length} requirement categories`);

// ─── Degree Requirements ──────────────────────────────────────────────────────
console.log("Seeding degree requirements...");
await run(`DELETE FROM degree_requirements`);

const reqs = [
  // CS Core (cat 1)
  [1, 1, 1, 1], // CS 101
  [2, 1, 2, 1], // CS 102
  [3, 1, 6, 1], // CS 201
  [4, 1, 7, 1], // CS 211
  [5, 1, 8, 1], // CS 221
  [6, 1, 11, 1], // CS 231 OS
  [7, 1, 12, 1], // CS 241 Databases
  [8, 1, 13, 1], // CS 311 Algorithms
  [9, 1, 14, 1], // CS 321 Software Eng
  [10, 1, 15, 1], // CS 331 Networks
  // CS Math (cat 2)
  [11, 2, 3, 1], // Calc I
  [12, 2, 4, 1], // Calc II
  [13, 2, 5, 1], // Discrete Math
  [14, 2, 9, 1], // Linear Algebra
  // CS Electives (cat 3) - pick 5
  [15, 3, 16, 0], // AI
  [16, 3, 17, 0], // Prog Languages
  [17, 3, 18, 0], // Security
  [18, 3, 19, 0], // ML
  [19, 3, 20, 0], // Distributed Systems
  [20, 3, 21, 0], // Graphics
  [21, 3, 24, 0], // Deep Learning
  [22, 3, 25, 0], // Cloud Computing
  // CS Gen Ed (cat 4)
  [23, 4, 26, 1], // ENG 101
  [24, 4, 27, 1], // ENG 102
  [25, 4, 28, 1], // HIST 101
  [26, 4, 29, 1], // Ethics
  [27, 4, 30, 1], // Public Speaking
  [28, 4, 10, 1], // Prob & Stats
  [29, 4, 44, 0], // Intro Psych (optional gen ed)
  // CS Capstone (cat 5)
  [30, 5, 22, 1], // Capstone I
  [31, 5, 23, 1], // Capstone II
  // Business Core (cat 7)
  [32, 7, 31, 1], // Intro Business
  [33, 7, 32, 1], // Accounting I
  [34, 7, 33, 1], // Accounting II
  [35, 7, 36, 1], // Corp Finance
  [36, 7, 37, 1], // Marketing
  [37, 7, 38, 1], // Operations
  [38, 7, 39, 1], // Org Behavior
  [39, 7, 41, 1], // Business Analytics
  // Business Economics (cat 8)
  [40, 8, 34, 1], // Microeconomics
  [41, 8, 35, 1], // Macroeconomics
  // Business Electives (cat 9)
  [42, 9, 40, 0], // Strategic Mgmt
  [43, 9, 42, 0], // Entrepreneurship
  // Business Gen Ed (cat 10)
  [44, 10, 26, 1], // ENG 101
  [45, 10, 27, 1], // ENG 102
  [46, 10, 28, 1], // HIST 101
  [47, 10, 29, 1], // Ethics
  [48, 10, 30, 1], // Public Speaking
  [49, 10, 3, 1], // Calc I
  [50, 10, 10, 1], // Prob & Stats
  // Business Capstone (cat 11)
  [51, 11, 43, 1], // Business Capstone
  // Psychology Core (cat 13)
  [52, 13, 44, 1], // Intro Psych
  [53, 13, 46, 1], // Cognitive
  [54, 13, 47, 1], // Abnormal
  [55, 13, 48, 1], // Social
  [56, 13, 49, 1], // Developmental
  [57, 13, 50, 1], // Neuroscience
  // Psych Research (cat 15)
  [58, 15, 45, 1], // Research Methods
  [59, 15, 10, 1], // Prob & Stats
  // Psych Gen Ed (cat 16)
  [60, 16, 26, 1], // ENG 101
  [61, 16, 27, 1], // ENG 102
  [62, 16, 28, 1], // HIST 101
  [63, 16, 29, 1], // Ethics
  [64, 16, 30, 1], // Public Speaking
  [65, 16, 1, 1], // CS 101 (gen ed tech)
  [66, 16, 3, 1], // Calc I
  // Psych Capstone (cat 17)
  [67, 17, 51, 1], // Psych Capstone
  // DS Minor Core (cat 19)
  [68, 19, 52, 1], // Intro DS
  [69, 19, 10, 1], // Prob & Stats
  [70, 19, 9, 1], // Linear Algebra
  // DS Minor Electives (cat 20)
  [71, 20, 53, 0], // Statistical Learning
  [72, 20, 54, 0], // Big Data
  [73, 20, 19, 0], // ML
];

for (const r of reqs) {
  await run(
    `INSERT INTO degree_requirements (id, categoryId, courseId, isRequired) VALUES (?, ?, ?, ?)`,
    r
  );
}

const writingCourseAlternatives = [
  6012, 6013, 6014, 6017, 6018, 6019, 6020, 6021, 6022, 6023, 6024, 6025, 6026,
  6027, 6028, 6029,
];
const internationalCourseAlternatives = [6006, 6012, 6013, 6014, 6021, 6022];
const upperEconomicsAlternatives = [
  6006,
  6007,
  6008,
  6009,
  6010,
  6011,
  ...writingCourseAlternatives,
];
const msuEconReqs = [
  ...[6000, 6001, 6004, 6005, 6015].map((courseId, index) => [
    6000 + index,
    6000,
    courseId,
    1,
    "[]",
    courseId === 6000 || courseId === 6001
      ? "MSU requires at least a 2.0 in EC 201 and EC 202 for Economics majors."
      : null,
  ]),
  [
    6010,
    6001,
    6008,
    0,
    JSON.stringify(internationalCourseAlternatives),
    "Default plan uses EC 340; alternatives are approved international area courses.",
  ],
  [
    6011,
    6002,
    6011,
    0,
    JSON.stringify(writingCourseAlternatives),
    "Default plan uses EC 404; alternatives are approved Tier II writing courses.",
  ],
  ...[6007, 6017, 6025].map((courseId, index) => [
    6012 + index,
    6003,
    courseId,
    0,
    JSON.stringify(upperEconomicsAlternatives),
    "Representative economics elective; advisor-approved alternatives may be used.",
  ]),
  [
    6015,
    6004,
    6030,
    0,
    JSON.stringify([6031, 6032]),
    "MTH 124, MTH 132, or MTH 152H satisfies the BA calculus requirement.",
  ],
  [
    6016,
    6005,
    6044,
    0,
    JSON.stringify([6045]),
    "STT 315 or STT 421 satisfies the BA statistics requirement.",
  ],
  [
    6017,
    6006,
    6052,
    0,
    JSON.stringify([6054]),
    "CSE 102 or CMSE 201 satisfies the BA computing requirement.",
  ],
  ...[6000, 6001, 6004, 6005, 6015].map((courseId, index) => [
    6020 + index,
    6010,
    courseId,
    1,
    "[]",
    courseId === 6000 || courseId === 6001
      ? "MSU requires at least a 2.0 in EC 201 and EC 202 for Economics majors."
      : null,
  ]),
  [
    6030,
    6011,
    6008,
    0,
    JSON.stringify(internationalCourseAlternatives),
    "Default plan uses EC 340; alternatives are approved international area courses.",
  ],
  [
    6031,
    6012,
    6011,
    0,
    JSON.stringify(writingCourseAlternatives),
    "Default plan uses EC 404; alternatives are approved Tier II writing courses.",
  ],
  [6032, 6013, 6009, 0, JSON.stringify([6010]), "Choose EC 401 or EC 402."],
  [
    6033,
    6014,
    6016,
    0,
    JSON.stringify([6029]),
    "Choose EC 421 or EC 499; EC 499 cannot also satisfy the writing course if used here.",
  ],
  [
    6034,
    6015,
    6007,
    0,
    JSON.stringify(upperEconomicsAlternatives),
    "Representative additional Economics elective.",
  ],
  [
    6035,
    6016,
    6031,
    0,
    JSON.stringify([6032]),
    "MTH 132 or MTH 152H satisfies Calculus I.",
  ],
  [
    6036,
    6017,
    6033,
    0,
    JSON.stringify([6034]),
    "MTH 133 or MTH 153H satisfies Calculus II.",
  ],
  [
    6037,
    6018,
    6048,
    0,
    JSON.stringify([6046, 6047, 6050]),
    "Default plan uses STT 430; alternatives are approved statistics options.",
  ],
  ...[6053, 6039].map((courseId, index) => [
    6038 + index,
    6019,
    courseId,
    0,
    JSON.stringify([
      6054, 6035, 6036, 6037, 6038, 6040, 6041, 6042, 6043, 6049, 6051,
    ]),
    "Representative quantitative/computing elective for the BS 7-credit requirement.",
  ]),
  ...[6000, 6001, 6004].map((courseId, index) => [
    6050 + index,
    6020,
    courseId,
    1,
    "[]",
    courseId === 6000 || courseId === 6001
      ? "EC 251H/252H substitutions may apply by advisor approval."
      : null,
  ]),
  [
    6053,
    6021,
    6011,
    0,
    JSON.stringify(writingCourseAlternatives),
    "Representative 400-level Economics elective.",
  ],
  ...[6006, 6007].map((courseId, index) => [
    6054 + index,
    6022,
    courseId,
    0,
    JSON.stringify(upperEconomicsAlternatives),
    "Representative 300-400 level Economics elective.",
  ]),
];

for (const r of msuEconReqs) {
  await run(
    `INSERT INTO degree_requirements (id, categoryId, courseId, isRequired, alternativeCourseIdsJson, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    r
  );
}
console.log(
  `✓ Inserted ${reqs.length + msuEconReqs.length} degree requirements`
);

// ─── Career Tracks ────────────────────────────────────────────────────────────
console.log("Seeding career tracks...");
await run(`DELETE FROM career_tracks`);

const tracks = [
  [
    1,
    "Software Engineering",
    "software_engineering",
    "Build production software systems, APIs, and applications at top tech companies",
    "Code2",
    "[8,14,12,15,20,25]",
    '{"1":[1,2,8],"2":[6,7,11],"3":[13,14,15],"4":[20,22,23]}',
  ],
  [
    2,
    "Machine Learning & AI",
    "machine_learning",
    "Develop ML models, AI systems, and data pipelines for research or industry",
    "Brain",
    "[16,19,24,9,10,52]",
    '{"1":[1,2,3],"2":[6,9,10],"3":[16,19,52],"4":[24,19,53]}',
  ],
  [
    3,
    "Data Science",
    "data_science",
    "Analyze data, build models, and generate insights for business decisions",
    "BarChart3",
    "[10,52,53,12,41,19]",
    '{"1":[1,3,10],"2":[6,9,52],"3":[12,53,16],"4":[19,54,41]}',
  ],
  [
    4,
    "Cybersecurity",
    "cybersecurity",
    "Protect systems and networks from threats and vulnerabilities",
    "Shield",
    "[15,18,11,7,13,20]",
    '{"1":[1,2,5],"2":[6,7,11],"3":[15,18,13],"4":[20,25,18]}',
  ],
  [
    5,
    "Cloud Computing & DevOps",
    "cloud_computing",
    "Build and manage scalable cloud infrastructure and deployment pipelines",
    "Cloud",
    "[11,15,20,25,12,14]",
    '{"1":[1,2,7],"2":[6,11,15],"3":[20,25,14],"4":[25,21,22]}',
  ],
  [
    6,
    "Quantitative Finance",
    "quantitative_finance",
    "Apply mathematical and computational methods to financial modeling and trading",
    "TrendingUp",
    "[3,4,9,10,36,41]",
    '{"1":[3,31,32],"2":[4,9,10],"3":[36,35,41],"4":[40,19,53]}',
  ],
  [
    7,
    "Business Management",
    "business_management",
    "Lead organizations, manage teams, and drive business strategy",
    "Briefcase",
    "[31,37,39,40,38,41]",
    '{"1":[31,34,26],"2":[32,35,37],"3":[38,39,36],"4":[40,41,43]}',
  ],
  [
    8,
    "Entrepreneurship",
    "entrepreneurship",
    "Launch startups, build products, and grow ventures from idea to market",
    "Rocket",
    "[31,37,42,40,14,41]",
    '{"1":[31,1,26],"2":[37,34,8],"3":[42,39,14],"4":[40,22,43]}',
  ],
  [
    9,
    "Graduate School (CS)",
    "grad_school_cs",
    "Prepare for PhD or MS programs in computer science or related fields",
    "GraduationCap",
    "[13,16,19,24,9,10]",
    '{"1":[1,3,5],"2":[6,9,13],"3":[16,19,17],"4":[24,20,22]}',
  ],
];

for (const t of tracks) {
  await run(
    `INSERT INTO career_tracks (id, name, slug, description, icon, priorityCourseIdsJson, recommendedByYearJson) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    t
  );
}
console.log(`✓ Inserted ${tracks.length} career tracks`);

await conn.end();
console.log("\n✅ Seeding complete!");

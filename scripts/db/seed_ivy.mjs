/**
 * Ivy League Comprehensive Seed Script
 * Seeds all 8 Ivy League schools with their complete programs (majors + minors),
 * representative courses, prerequisites, and degree requirements.
 *
 * Schools: Harvard, Yale, Princeton, Columbia, Penn, Brown, Dartmouth, Cornell
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function upsertSchool(s) {
  const [r] = await db.execute(
    `INSERT INTO schools (name, shortName, location)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE shortName=VALUES(shortName), location=VALUES(location)`,
    [s.name, s.shortName, s.location ?? null]
  );
  if (r.insertId) return r.insertId;
  const [[row]] = await db.execute(`SELECT id FROM schools WHERE name=?`, [s.name]);
  return row.id;
}

async function upsertProgram(p) {
  const [r] = await db.execute(
    `INSERT INTO programs (schoolId, name, shortName, type, description, totalCreditsRequired)
     VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE type=VALUES(type), description=VALUES(description)`,
    [p.schoolId, p.name, p.shortName ?? p.name.substring(0, 30), p.type, p.description ?? "", p.total ?? 128]
  );
  if (r.insertId) return r.insertId;
  const [[row]] = await db.execute(`SELECT id FROM programs WHERE schoolId=? AND name=? AND type=?`, [p.schoolId, p.name, p.type]);
  return row.id;
}

async function upsertCourse(c) {
  const [r] = await db.execute(
    `INSERT INTO courses (schoolId, code, name, description, credits, difficultyLevel, workloadHours,
       availableFall, availableSpring, availableSummer, isUpperDivision, tagsJson, careerTracksJson)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
    [
      c.schoolId, c.code, c.name, c.description ?? "",
      c.credits ?? 4, c.difficulty ?? 3, c.workload ?? 10,
      c.fall ?? 1, c.spring ?? 1, c.summer ?? 0,
      c.upper ?? 0,
      JSON.stringify(c.tags ?? []),
      JSON.stringify(c.careers ?? [])
    ]
  );
  if (r.insertId) return r.insertId;
  const [[row]] = await db.execute(`SELECT id FROM courses WHERE schoolId=? AND code=?`, [c.schoolId, c.code]);
  return row.id;
}

async function addPrereq(courseId, prereqId, type = "required") {
  await db.execute(
    `INSERT IGNORE INTO prerequisites (courseId, prerequisiteCourseId, type) VALUES (?,?,?)`,
    [courseId, prereqId, type]
  );
}

// categoryCache: programId -> { categoryName -> categoryId }
const categoryCache = {};

async function getOrCreateCategory(programId, categoryName, type = "core", creditsRequired = 32) {
  if (!categoryCache[programId]) categoryCache[programId] = {};
  if (categoryCache[programId][categoryName]) return categoryCache[programId][categoryName];
  const [r] = await db.execute(
    `INSERT INTO requirement_categories (programId, name, type, creditsRequired)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name)`,
    [programId, categoryName, type, creditsRequired]
  );
  let catId = r.insertId;
  if (!catId) {
    const [[row]] = await db.execute(`SELECT id FROM requirement_categories WHERE programId=? AND name=?`, [programId, categoryName]);
    catId = row.id;
  }
  categoryCache[programId][categoryName] = catId;
  return catId;
}

async function addRequirement(programId, courseId, category, required = true) {
  const catId = await getOrCreateCategory(programId, category, category === "Core" ? "core" : "elective", 32);
  await db.execute(
    `INSERT IGNORE INTO degree_requirements (categoryId, courseId, isRequired, notes)
     VALUES (?,?,?,?)`,
    [catId, courseId, required ? 1 : 0, ""]
  );
}

// ─── SCHOOL DATA ────────────────────────────────────────────────────────────

const SCHOOLS = [
  { name: "Harvard University",           shortName: "Harvard",   location: "Cambridge, MA",      totalCredits: 128 },
  { name: "Yale University",              shortName: "Yale",      location: "New Haven, CT",      totalCredits: 120 },
  { name: "Princeton University",         shortName: "Princeton", location: "Princeton, NJ",      totalCredits: 128 },
  { name: "Columbia University",          shortName: "Columbia",  location: "New York City, NY",  totalCredits: 124 },
  { name: "University of Pennsylvania",   shortName: "Penn",      location: "Philadelphia, PA",   totalCredits: 120 },
  { name: "Brown University",             shortName: "Brown",     location: "Providence, RI",     totalCredits: 120 },
  { name: "Dartmouth College",            shortName: "Dartmouth", location: "Hanover, NH",        totalCredits: 120 },
  { name: "Cornell University",           shortName: "Cornell",   location: "Ithaca, NY",         totalCredits: 120 },
];

// ─── PROGRAMS PER SCHOOL ────────────────────────────────────────────────────

// Harvard concentrations (majors) and secondary fields (minors)
const HARVARD_MAJORS = [
  "African and African American Studies","Anthropology","Applied Mathematics","Archaeology",
  "Art, Film, and Visual Studies","Astrophysics","Biomedical Engineering","Chemical and Physical Biology",
  "Chemistry","Classics","Comparative Literature","Computer Science","East Asian Studies","Economics",
  "Electrical Engineering","Engineering Sciences","English","Environmental Science and Engineering",
  "Environmental Science and Public Policy","Ethnicity, Migration, Rights","Folklore and Mythology",
  "Germanic Languages and Literatures","Government","History","History and Literature","History and Science",
  "History of Art and Architecture","Human Developmental and Regenerative Biology","Human Evolutionary Biology",
  "Integrative Biology","Linguistics","Mathematics","Mechanical Engineering","Molecular and Cellular Biology",
  "Music","Near Eastern Languages and Civilizations","Neuroscience","Philosophy","Physics","Psychology",
  "Religion","Romance Languages and Literatures","Slavic Languages and Literatures","Social Studies",
  "Sociology","South Asian Studies","Statistics","Studies of Women, Gender, and Sexuality",
  "Theater, Dance & Media","Special Concentration"
];
const HARVARD_MINORS = [
  "African and African American Studies","Anthropology","Applied Mathematics","Archaeology",
  "Art, Film, and Visual Studies","Astrophysics","Celtic Languages and Literatures","Chemistry","Classics",
  "Comparative Literature","Computer Science","East Asian Studies","Economics","Educational Studies",
  "Electrical Engineering","Energy and the Environment","English","Environmental Science and Engineering",
  "Ethnicity, Migration, and Rights","European History, Politics, and Societies","Folklore and Mythology",
  "Germanic Languages and Literatures","Global Health and Health Policy","Government","History",
  "History and Literature","History of Art and Architecture","History of Science","Human Evolutionary Biology",
  "Integrative Biology","Linguistics","Medieval Studies","Microbial Sciences","Mind, Brain, Behavior",
  "Molecular and Cellular Biology","Music","Near Eastern Languages and Civilizations","Neuroscience",
  "Philosophy","Physics","Psychology","Religion","Romance Languages and Literatures",
  "Slavic Languages and Literatures","Sociology","South Asian Studies","Studies of Women, Gender, and Sexuality",
  "Theater, Dance & Media","Translation Studies"
];

// Yale majors and certificates
const YALE_MAJORS = [
  "African Studies","American Studies","Anthropology","Applied Mathematics","Applied Physics",
  "Archaeological Studies","Architecture","Art","Astronomy","Biomedical Engineering","Chemical Engineering",
  "Chemistry","Classical Civilization","Classics","Cognitive Science","Computer Science",
  "East Asian Languages and Literatures","East Asian Studies","Economics","Electrical Engineering",
  "English Language and Literature","Environmental Engineering","Environmental Studies","Ethics, Politics, and Economics",
  "Film and Media Studies","French","German","Global Affairs","History","History of Art","History of Science, Medicine, and Public Health",
  "Humanities","Italian","Judaic Studies","Latin American Studies","Linguistics","Mathematics",
  "Mechanical Engineering","Modern Middle East Studies","Molecular Biophysics and Biochemistry",
  "Molecular, Cellular, and Developmental Biology","Music","Near Eastern Languages and Civilizations",
  "Neuroscience","Philosophy","Physics","Political Science","Portuguese","Psychology","Religious Studies",
  "Russian","Sociology","South Asian Studies","Spanish","Statistics and Data Science","Theater and Performance Studies",
  "Women's, Gender, and Sexuality Studies"
];
const YALE_MINORS = [
  "Ancient Egyptian","Ancient Greek","Chinese","French","German","Modern Arabic","Modern Hebrew",
  "Hindi","Indonesian","isiZulu","Italian","Japanese","Kiswahili","Korean","Latin","Portuguese",
  "Russian","Sanskrit","Spanish","Modern Turkish","Vietnamese","Yoruba",
  "Climate Science and Solutions","Computing, Culture & Society","Education Studies",
  "Energy Studies","Food, Agriculture, and Climate Change","Global Health Studies",
  "Human Rights Studies","Islamic Studies","Medieval Studies","Native American and Indigenous Studies",
  "Persian and Iranian Studies","Translation Studies","Collections: Objects, Research, Society",
  "Data Science","Ethnography","Programming","Quantum Science and Engineering","Technology Entrepreneurship"
];

// Princeton majors (departments/programs) and minors/certificates
const PRINCETON_MAJORS = [
  "African American Studies","African Studies","American Studies","Anthropology",
  "Applied and Computational Mathematics","Archaeology","Architecture","Art and Archaeology",
  "Astrophysical Sciences","Bioengineering","Chemical and Biological Engineering","Chemistry",
  "Civil and Environmental Engineering","Classics","Climate Science","Cognitive Science",
  "Comparative Literature","Computer Science","Ecology and Evolutionary Biology","Economics",
  "Electrical and Computer Engineering","Engineering Physics","English","Environmental Studies",
  "French and Italian","Gender and Sexuality Studies","Geosciences","German",
  "Global Health and Health Policy","History","History of Art","History of Science, Technology, and Medicine",
  "Humanistic Studies","Latin American Studies","Latino Studies","Linguistics",
  "Materials Science and Engineering","Mathematics","Mechanical and Aerospace Engineering",
  "Medieval Studies","Molecular Biology","Music","Near Eastern Studies","Neuroscience",
  "Operations Research and Financial Engineering","Philosophy","Physics","Politics",
  "Princeton School of Public and International Affairs","Psychology",
  "Quantitative and Computational Biology","Religion","Russian, East European and Eurasian Studies",
  "Slavic Languages and Literatures","Sociology","South Asian Studies","Spanish and Portuguese",
  "Statistics and Machine Learning","Theater and Music Theater"
];
const PRINCETON_MINORS = [
  "Arabic Language","Asian American Studies","Chinese Language","Computing, Society and Policy",
  "Creative Writing","Dance","East Asian Studies","Entrepreneurship","European Studies","Finance",
  "Hebrew Language","Hellenic Studies","History and the Practice of Diplomacy","Japanese Language",
  "Journalism","Judaic Studies","Korean Language","Music Performance","Optimization and Quantitative Decision Science",
  "Persian Language","Planets and Life","Quantitative Economics","Robotics","Sustainable Energy",
  "Teacher Preparation","Technology and Society","Translation and Intercultural Communication",
  "Turkish Language","Urban Studies","Values and Public Life","Visual Arts"
];

// Columbia majors and minors
const COLUMBIA_MAJORS = [
  "African American and African Diaspora Studies","American Studies","Ancient Studies","Anthropology",
  "Archaeology","Architecture","Art History and Archaeology","Astronomy","Biological Sciences",
  "Business","Chemistry","Classics","Cognitive Science","Comparative Literature and Society",
  "Computer Science","Creative Writing","Dance","Drama and Theatre Arts","Earth and Environmental Sciences",
  "East Asian Languages and Cultures","Ecology, Evolution, and Environmental Biology","Economics",
  "Education","English and Comparative Literature","Ethnicity and Race Studies","Film and Media Studies",
  "French","Germanic Languages","History","Human Rights","Italian","Jazz Studies","Jewish Studies",
  "Latin American and Caribbean Studies","Latin American and Iberian Cultures","Linguistics","Mathematics",
  "Medieval and Renaissance Studies","Middle Eastern, South Asian, and African Studies","Music",
  "Philosophy","Physics","Political Science","Psychology","Public Health","Religion",
  "Science and Society","Slavic Languages","Sociology","Statistics","Sustainable Development",
  "Urban Studies","Visual Arts","Women's and Gender Studies"
];
const COLUMBIA_MINORS = [
  "African American and African Diaspora Studies","American Studies","Ancient Studies","Anthropology",
  "Archaeology","Art History","Astronomy","Biological Sciences","Chemistry","Classics",
  "Cognitive Science","Computer Science","Creative Writing","Dance","Drama and Theatre Arts",
  "Earth and Environmental Sciences","East Asian Studies","Economics","Education","English",
  "Ethnicity and Race Studies","Film and Media Studies","French","Germanic Languages","History",
  "Human Rights","Italian","Jazz Studies","Jewish Studies","Latin American and Caribbean Studies",
  "Linguistics","Mathematics","Medieval and Renaissance Studies","Music","Philosophy","Physics",
  "Political Science","Psychology","Public Health","Religion","Science and Society","Slavic Languages",
  "Sociology","Statistics","Sustainable Development","Urban Studies","Visual Arts","Women's and Gender Studies"
];

// Penn majors and minors (Wharton + College + SEAS)
const PENN_MAJORS = [
  "Accounting","Actuarial Mathematics","African Studies","Africana Studies","American History",
  "Ancient History","Anthropology","Architecture","Behavioral Economics","Biochemistry",
  "Biophysics","Business Analytics","Chemistry","Cinema Studies","Classical Studies",
  "Cognitive Science","Communication","Comparative Literature","Computer Science","Criminology",
  "Digital Media Design","Earth Science","East Asian Area Studies","Economics","Education",
  "Electrical Engineering","Engineering","English","Environmental Studies","Finance",
  "Fine Arts","Folklore and Folklife","French and Francophone Studies","Gender, Sexuality, and Women's Studies",
  "German","Health and Societies","History","History and Sociology of Science","International Relations",
  "Italian Studies","Jewish Studies","Latin American and Latino Studies","Linguistics",
  "Management","Marketing","Materials Science and Engineering","Mathematics","Mechanical Engineering",
  "Music","Near Eastern Languages and Civilizations","Neuroscience","Operations, Information, and Decisions",
  "Philosophy","Physics","Political Science","Psychology","Real Estate","Religious Studies",
  "Russian and East European Studies","Science, Technology, and Society","Social Policy",
  "Sociology","South Asia Studies","Spanish","Statistics","Systems Engineering","Urban Studies"
];
const PENN_MINORS = [
  "Accounting","African Studies","Africana Studies","Ancient History","Anthropology",
  "Architecture","Art History","Biochemistry","Biophysics","Business","Chemistry",
  "Cinema Studies","Classical Studies","Cognitive Science","Communication","Comparative Literature",
  "Computer Science","Criminology","Economics","Education","English","Environmental Studies",
  "Finance","Fine Arts","Folklore and Folklife","French","Gender Studies","German",
  "Health and Societies","History","International Relations","Italian","Jewish Studies",
  "Latin American Studies","Linguistics","Mathematics","Music","Neuroscience","Philosophy",
  "Physics","Political Science","Psychology","Religious Studies","Russian Studies",
  "Science and Technology Studies","Sociology","South Asia Studies","Spanish","Statistics",
  "Urban Studies","Women's Studies"
];

// Brown concentrations (majors) and certificates (minors)
const BROWN_MAJORS = [
  "Africana Studies","American Studies","Anthropology","Applied Mathematics",
  "Applied Mathematics-Biology","Applied Mathematics-Computer Science","Applied Mathematics-Economics",
  "Archaeology and the Ancient World","Architecture","Astronomy","Behavioral Decision Sciences",
  "Biochemistry & Molecular Biology","Biology","Biomedical Engineering","Biophysics",
  "Chemical Engineering","Chemical Physics","Chemistry","Classics","Cognitive Neuroscience",
  "Cognitive Science","Comparative Literature","Computational Biology",
  "Computational Chemistry and Chemical Physics","Computational Neuroscience","Computer Engineering",
  "Computer Science","Computer Science-Economics","Contemplative Studies",
  "Critical Native American and Indigenous Studies","Design Engineering","Early Modern World",
  "Earth and Planetary Science","Earth, Climate, and Biology","East Asian Studies","Economics",
  "Education Studies","Egyptology and Assyriology","Electrical Engineering","Engineering",
  "Engineering and Physics","English","Environmental Engineering","Environmental Sciences and Studies",
  "Ethnic Studies","French and Francophone Studies","Gender and Sexuality Studies",
  "Geochemistry and Environmental Chemistry","Geophysics and Climate Physics","German Studies",
  "Health & Human Biology","Hispanic Literatures and Cultures","History",
  "History of Art and Architecture","Independent Concentration","International and Public Affairs",
  "Italian Studies","Judaic Studies","Latin American and Caribbean Studies","Linguistics",
  "Literary Arts","Materials Engineering","Mathematics","Mathematics-Computer Science",
  "Mathematics-Economics","Mechanical Engineering","Medieval Cultures","Middle East Studies",
  "Modern Culture and Media","Music","Neuroscience","Philosophy","Physics","Physics and Philosophy",
  "Political Science","Portuguese and Brazilian Studies","Psychology","Public Health",
  "Religious Studies","Science, Technology, and Society","Slavic Studies",
  "Social Analysis and Research","Sociology","South Asian Studies","Statistics",
  "Theatre Arts and Performance Studies","Urban Studies","Visual Art"
];
const BROWN_MINORS = [
  "Data Fluency","Engaged Scholarship","Entrepreneurship","European Critical Thought",
  "Intercultural Competence","Migration Studies"
];

// Dartmouth majors and minors
const DARTMOUTH_MAJORS = [
  "African and African American Studies","Anthropology","Art History","Asian and Middle Eastern Studies",
  "Asian Societies, Cultures, and Languages","Biochemistry","Biology","Biomedical Engineering",
  "Chemistry","Chinese","Classical Languages and Literatures","Cognitive Science","Comparative Literature",
  "Computer Science","Earth Sciences","Economics","Education","Engineering","Engineering Sciences",
  "English","Environmental Studies","Film and Media Studies","French","Geography",
  "German Studies","Government","History","Japanese","Jewish Studies","Latin American, Latino, and Caribbean Studies",
  "Linguistics","Mathematics","Middle Eastern Studies","Music","Native American and Indigenous Studies",
  "Neuroscience","Philosophy","Physics and Astronomy","Psychological and Brain Sciences",
  "Quantitative Social Science","Religion","Russian","Sociology","Spanish and Portuguese",
  "Studio Art","Theater","Women's, Gender, and Sexuality Studies"
];
const DARTMOUTH_MINORS = [
  "African and African American Studies","Anthropology","Art History","Asian and Middle Eastern Studies",
  "Biochemistry","Biology","Chemistry","Chinese","Classical Languages and Literatures",
  "Cognitive Science","Comparative Literature","Computer Science","Creative Writing","Earth Sciences",
  "Economics","Education","Engineering","English","Environmental Studies","Film and Media Studies",
  "French","Geography","German Studies","Government","History","Italian","Japanese",
  "Jewish Studies","Latin American Studies","Linguistics","Mathematics","Middle Eastern Studies",
  "Music","Native American Studies","Neuroscience","Philosophy","Physics and Astronomy",
  "Psychology","Religion","Russian","Sociology","Spanish","Studio Art","Theater",
  "Women's and Gender Studies"
];

// Cornell majors and minors (across all colleges)
const CORNELL_MAJORS = [
  "Africana Studies","Agricultural Sciences","American Studies","Animal Science",
  "Anthropology","Applied Economics and Management","Architecture","Art","Asian Studies",
  "Astronomy","Atmospheric Sciences","Biochemistry","Biological Engineering","Biology",
  "Biometry and Statistics","Chemical Engineering","Chemistry","Civil Engineering",
  "Classics","Cognitive Science","Communication","Comparative Literature","Computer Science",
  "Design and Environmental Analysis","Development Sociology","Earth and Atmospheric Sciences",
  "Economics","Electrical and Computer Engineering","Engineering Physics","English",
  "Entomology","Environmental Engineering","Environmental Science","Environmental Studies",
  "Fiber Science and Apparel Design","Food Science","Genetics and Development",
  "German Studies","Global and Public Health Sciences","Government","History","History of Art",
  "Hotel Administration","Human Biology, Health, and Society","Human Development",
  "Industrial and Labor Relations","Information Science","International Agriculture and Rural Development",
  "Landscape Architecture","Linguistics","Materials Science and Engineering","Mathematics",
  "Mechanical Engineering","Microbiology","Music","Near Eastern Studies","Neuroscience",
  "Nutritional Sciences","Operations Research and Engineering","Philosophy","Physics",
  "Plant Sciences","Policy Analysis and Management","Political Science","Psychology",
  "Religious Studies","Science of Earth Systems","Science, Technology, and Society",
  "Sociology","Spanish","Statistics","Systems Engineering","Theatre Arts","Urban and Regional Studies",
  "Women's and Feminist Studies"
];
const CORNELL_MINORS = [
  "Africana Studies","American Studies","Anthropology","Applied Economics","Architecture",
  "Art","Asian Studies","Astronomy","Atmospheric Sciences","Biochemistry","Biology",
  "Biometry and Statistics","Chemical Engineering","Chemistry","Civil Engineering","Classics",
  "Cognitive Science","Communication","Comparative Literature","Computer Science",
  "Creative Writing","Development Sociology","Earth Sciences","Economics","Education",
  "Electrical Engineering","Engineering Management","English","Entomology","Environmental Studies",
  "Film","Food Science","Genetics","German Studies","Global Health","Government",
  "History","History of Art","Hotel Administration","Human Development","Information Science",
  "International Agriculture","Labor Relations","Landscape Architecture","Law and Society",
  "Linguistics","Materials Science","Mathematics","Mechanical Engineering","Microbiology",
  "Music","Near Eastern Studies","Neuroscience","Nutritional Sciences","Operations Research",
  "Philosophy","Physics","Plant Sciences","Policy Analysis","Political Science","Psychology",
  "Religious Studies","Science and Technology Studies","Sociology","Spanish","Statistics",
  "Systems Engineering","Theatre Arts","Urban Studies","Women's Studies"
];

// ─── REPRESENTATIVE COURSES PER DISCIPLINE ──────────────────────────────────
// We create a shared set of discipline-level courses for each school,
// tagged by discipline so they can be linked to programs.

function buildCourseSet(schoolId, prefix) {
  return [
    // ── COMPUTER SCIENCE ──
    { schoolId, code: `${prefix}CS101`, name: "Introduction to Computer Science", description: "Fundamentals of programming and computational thinking.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["programming","cs"], careers: ["software_engineering","data_science"] },
    { schoolId, code: `${prefix}CS201`, name: "Data Structures and Algorithms", description: "Arrays, linked lists, trees, graphs, sorting, and complexity.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["algorithms","cs"], careers: ["software_engineering"] },
    { schoolId, code: `${prefix}CS301`, name: "Systems Programming", description: "Operating systems, memory management, concurrency.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 0, upper: 1, tags: ["systems","cs"], careers: ["software_engineering"] },
    { schoolId, code: `${prefix}CS302`, name: "Theory of Computation", description: "Automata, formal languages, Turing machines, complexity.", credits: 4, difficulty: 5, workload: 14, fall: 1, spring: 1, upper: 1, tags: ["theory","cs"], careers: ["software_engineering","academia"] },
    { schoolId, code: `${prefix}CS401`, name: "Artificial Intelligence", description: "Search, knowledge representation, machine learning basics.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["ai","ml"], careers: ["data_science","software_engineering"] },
    { schoolId, code: `${prefix}CS402`, name: "Machine Learning", description: "Supervised and unsupervised learning, neural networks.", credits: 4, difficulty: 5, workload: 15, fall: 1, spring: 1, upper: 1, tags: ["ml","ai"], careers: ["data_science"] },
    { schoolId, code: `${prefix}CS403`, name: "Database Systems", description: "Relational model, SQL, transactions, query optimization.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["databases","cs"], careers: ["software_engineering","data_science"] },
    { schoolId, code: `${prefix}CS404`, name: "Computer Networks", description: "TCP/IP, routing, network security, distributed systems.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 0, upper: 1, tags: ["networks","cs"], careers: ["software_engineering"] },
    { schoolId, code: `${prefix}CS405`, name: "Software Engineering", description: "Software design patterns, testing, agile development.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["software","engineering"], careers: ["software_engineering"] },
    { schoolId, code: `${prefix}CS406`, name: "Computer Graphics", description: "Rendering, shaders, 3D transformations, ray tracing.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 0, upper: 1, tags: ["graphics","cs"], careers: ["software_engineering"] },
    // ── MATHEMATICS ──
    { schoolId, code: `${prefix}MATH101`, name: "Calculus I", description: "Limits, derivatives, integrals, and applications.", credits: 4, difficulty: 2, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["calculus","math"], careers: ["academia","finance"] },
    { schoolId, code: `${prefix}MATH102`, name: "Calculus II", description: "Integration techniques, series, and multivariable intro.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["calculus","math"], careers: ["academia","finance"] },
    { schoolId, code: `${prefix}MATH201`, name: "Multivariable Calculus", description: "Partial derivatives, multiple integrals, vector calculus.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["calculus","math"], careers: ["academia"] },
    { schoolId, code: `${prefix}MATH202`, name: "Linear Algebra", description: "Vectors, matrices, eigenvalues, linear transformations.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["linear_algebra","math"], careers: ["data_science","academia"] },
    { schoolId, code: `${prefix}MATH301`, name: "Differential Equations", description: "ODEs, PDEs, Laplace transforms, applications.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["diff_eq","math"], careers: ["academia","engineering"] },
    { schoolId, code: `${prefix}MATH302`, name: "Probability Theory", description: "Probability spaces, random variables, distributions.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["probability","math"], careers: ["data_science","finance","academia"] },
    { schoolId, code: `${prefix}MATH401`, name: "Real Analysis", description: "Rigorous treatment of limits, continuity, and integration.", credits: 4, difficulty: 5, workload: 16, fall: 1, spring: 1, upper: 1, tags: ["analysis","math"], careers: ["academia"] },
    { schoolId, code: `${prefix}MATH402`, name: "Abstract Algebra", description: "Groups, rings, fields, Galois theory.", credits: 4, difficulty: 5, workload: 16, fall: 1, spring: 0, upper: 1, tags: ["algebra","math"], careers: ["academia"] },
    // ── ECONOMICS ──
    { schoolId, code: `${prefix}ECON101`, name: "Principles of Microeconomics", description: "Supply and demand, market equilibrium, consumer theory.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["micro","economics"], careers: ["finance","consulting"] },
    { schoolId, code: `${prefix}ECON102`, name: "Principles of Macroeconomics", description: "GDP, inflation, monetary and fiscal policy.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["macro","economics"], careers: ["finance","consulting"] },
    { schoolId, code: `${prefix}ECON201`, name: "Intermediate Microeconomics", description: "Consumer and producer theory, game theory.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["micro","economics"], careers: ["finance","consulting"] },
    { schoolId, code: `${prefix}ECON202`, name: "Intermediate Macroeconomics", description: "Growth models, business cycles, open economy.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["macro","economics"], careers: ["finance"] },
    { schoolId, code: `${prefix}ECON301`, name: "Econometrics", description: "Regression analysis, hypothesis testing, causal inference.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["econometrics","statistics"], careers: ["finance","data_science"] },
    { schoolId, code: `${prefix}ECON401`, name: "Game Theory", description: "Strategic interaction, Nash equilibria, mechanism design.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 0, upper: 1, tags: ["game_theory","economics"], careers: ["consulting","finance"] },
    // ── PHYSICS ──
    { schoolId, code: `${prefix}PHYS101`, name: "Classical Mechanics", description: "Newton's laws, energy, momentum, oscillations.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["mechanics","physics"], careers: ["academia","engineering"] },
    { schoolId, code: `${prefix}PHYS102`, name: "Electricity and Magnetism", description: "Electric fields, circuits, Maxwell's equations.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["electromagnetism","physics"], careers: ["academia","engineering"] },
    { schoolId, code: `${prefix}PHYS201`, name: "Quantum Mechanics", description: "Wave functions, Schrödinger equation, spin.", credits: 4, difficulty: 5, workload: 16, fall: 1, spring: 1, upper: 1, tags: ["quantum","physics"], careers: ["academia"] },
    { schoolId, code: `${prefix}PHYS202`, name: "Thermodynamics and Statistical Mechanics", description: "Laws of thermodynamics, entropy, partition functions.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 1, upper: 1, tags: ["thermo","physics"], careers: ["academia","engineering"] },
    // ── CHEMISTRY ──
    { schoolId, code: `${prefix}CHEM101`, name: "General Chemistry I", description: "Atomic structure, bonding, stoichiometry.", credits: 4, difficulty: 2, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["chemistry"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}CHEM102`, name: "General Chemistry II", description: "Equilibrium, kinetics, electrochemistry.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["chemistry"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}CHEM201`, name: "Organic Chemistry I", description: "Functional groups, reaction mechanisms, stereochemistry.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 1, upper: 0, tags: ["organic","chemistry"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}CHEM202`, name: "Organic Chemistry II", description: "Advanced synthesis, spectroscopy, biomolecules.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 1, upper: 1, tags: ["organic","chemistry"], careers: ["healthcare","academia"] },
    // ── BIOLOGY ──
    { schoolId, code: `${prefix}BIO101`, name: "Introductory Biology I", description: "Cell biology, genetics, evolution.", credits: 4, difficulty: 2, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["biology"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}BIO102`, name: "Introductory Biology II", description: "Ecology, physiology, diversity of life.", credits: 4, difficulty: 2, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["biology"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}BIO201`, name: "Genetics", description: "Mendelian genetics, molecular genetics, genomics.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["genetics","biology"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}BIO301`, name: "Cell Biology", description: "Cell structure, signaling, the cell cycle.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["cell_bio","biology"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}BIO401`, name: "Neuroscience", description: "Neural circuits, synaptic transmission, brain systems.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 1, upper: 1, tags: ["neuro","biology"], careers: ["healthcare","academia"] },
    // ── STATISTICS / DATA SCIENCE ──
    { schoolId, code: `${prefix}STAT101`, name: "Introduction to Statistics", description: "Descriptive statistics, probability, hypothesis testing.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["statistics"], careers: ["data_science","finance"] },
    { schoolId, code: `${prefix}STAT201`, name: "Statistical Inference", description: "Estimation, confidence intervals, regression.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["statistics","inference"], careers: ["data_science","finance"] },
    { schoolId, code: `${prefix}STAT301`, name: "Applied Regression Analysis", description: "Linear and logistic regression, model selection.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["regression","statistics"], careers: ["data_science"] },
    { schoolId, code: `${prefix}STAT401`, name: "Bayesian Statistics", description: "Prior distributions, MCMC, Bayesian inference.", credits: 4, difficulty: 5, workload: 14, fall: 1, spring: 0, upper: 1, tags: ["bayesian","statistics"], careers: ["data_science","academia"] },
    // ── PSYCHOLOGY ──
    { schoolId, code: `${prefix}PSYC101`, name: "Introduction to Psychology", description: "Biological, cognitive, social, and clinical psychology.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["psychology"], careers: ["healthcare","consulting"] },
    { schoolId, code: `${prefix}PSYC201`, name: "Research Methods in Psychology", description: "Experimental design, statistics, ethics.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["research","psychology"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}PSYC301`, name: "Cognitive Psychology", description: "Memory, attention, language, problem solving.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["cognitive","psychology"], careers: ["healthcare","consulting"] },
    { schoolId, code: `${prefix}PSYC401`, name: "Clinical Psychology", description: "Psychopathology, diagnosis, evidence-based treatments.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["clinical","psychology"], careers: ["healthcare"] },
    // ── HISTORY ──
    { schoolId, code: `${prefix}HIST101`, name: "World History I", description: "Ancient civilizations through the early modern period.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["history"], careers: ["academia","consulting"] },
    { schoolId, code: `${prefix}HIST102`, name: "World History II", description: "Modern history from 1500 to the present.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["history"], careers: ["academia","consulting"] },
    { schoolId, code: `${prefix}HIST301`, name: "Historiography", description: "Methods of historical research and writing.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["historiography","history"], careers: ["academia"] },
    // ── PHILOSOPHY ──
    { schoolId, code: `${prefix}PHIL101`, name: "Introduction to Philosophy", description: "Epistemology, metaphysics, ethics, logic.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["philosophy"], careers: ["academia","consulting"] },
    { schoolId, code: `${prefix}PHIL201`, name: "Logic and Critical Reasoning", description: "Formal logic, argument analysis, fallacies.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["logic","philosophy"], careers: ["academia"] },
    { schoolId, code: `${prefix}PHIL301`, name: "Ethics", description: "Normative ethics, metaethics, applied ethics.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["ethics","philosophy"], careers: ["academia","consulting"] },
    // ── POLITICAL SCIENCE ──
    { schoolId, code: `${prefix}POLS101`, name: "Introduction to Political Science", description: "Political institutions, behavior, and theory.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["polisci"], careers: ["consulting","academia"] },
    { schoolId, code: `${prefix}POLS201`, name: "Comparative Politics", description: "Political systems across countries.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["comparative","polisci"], careers: ["consulting"] },
    { schoolId, code: `${prefix}POLS301`, name: "International Relations", description: "Global politics, diplomacy, conflict.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["ir","polisci"], careers: ["consulting","academia"] },
    // ── SOCIOLOGY ──
    { schoolId, code: `${prefix}SOC101`, name: "Introduction to Sociology", description: "Social structures, institutions, and inequality.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["sociology"], careers: ["academia","consulting"] },
    { schoolId, code: `${prefix}SOC201`, name: "Social Research Methods", description: "Quantitative and qualitative research design.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["research","sociology"], careers: ["academia"] },
    // ── ENGLISH / WRITING ──
    { schoolId, code: `${prefix}ENG101`, name: "Expository Writing", description: "Academic writing, argumentation, and revision.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["writing","english"], careers: ["consulting","academia"] },
    { schoolId, code: `${prefix}ENG201`, name: "Introduction to Literary Studies", description: "Close reading, literary theory, and criticism.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["literature","english"], careers: ["academia"] },
    { schoolId, code: `${prefix}ENG301`, name: "American Literature", description: "Major works and movements in American literature.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["american_lit","english"], careers: ["academia"] },
    // ── ENGINEERING ──
    { schoolId, code: `${prefix}ENGR101`, name: "Introduction to Engineering", description: "Engineering design, problem solving, and ethics.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["engineering"], careers: ["engineering"] },
    { schoolId, code: `${prefix}ENGR201`, name: "Statics and Dynamics", description: "Equilibrium, kinematics, and kinetics.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 1, upper: 0, tags: ["mechanics","engineering"], careers: ["engineering"] },
    { schoolId, code: `${prefix}ENGR301`, name: "Thermodynamics for Engineers", description: "Energy, entropy, and thermodynamic cycles.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["thermo","engineering"], careers: ["engineering"] },
    { schoolId, code: `${prefix}ENGR401`, name: "Senior Design Project", description: "Capstone engineering design and implementation.", credits: 4, difficulty: 4, workload: 16, fall: 1, spring: 1, upper: 1, tags: ["capstone","engineering"], careers: ["engineering"] },
    // ── LINGUISTICS ──
    { schoolId, code: `${prefix}LING101`, name: "Introduction to Linguistics", description: "Phonology, morphology, syntax, semantics.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["linguistics"], careers: ["academia"] },
    { schoolId, code: `${prefix}LING301`, name: "Syntax", description: "Phrase structure, transformations, universal grammar.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 0, upper: 1, tags: ["syntax","linguistics"], careers: ["academia"] },
    // ── MUSIC ──
    { schoolId, code: `${prefix}MUS101`, name: "Music Theory I", description: "Notation, scales, intervals, harmony.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["music"], careers: ["academia"] },
    { schoolId, code: `${prefix}MUS201`, name: "Music History", description: "Western music from medieval to contemporary.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["music_history","music"], careers: ["academia"] },
    // ── ANTHROPOLOGY ──
    { schoolId, code: `${prefix}ANTH101`, name: "Introduction to Anthropology", description: "Cultural, biological, archaeological, and linguistic anthropology.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["anthropology"], careers: ["academia","consulting"] },
    { schoolId, code: `${prefix}ANTH301`, name: "Cultural Anthropology", description: "Ethnographic methods, cultural theory, fieldwork.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["cultural","anthropology"], careers: ["academia"] },
    // ── NEUROSCIENCE ──
    { schoolId, code: `${prefix}NEUR301`, name: "Cellular Neuroscience", description: "Neurons, synapses, ion channels, action potentials.", credits: 4, difficulty: 4, workload: 14, fall: 1, spring: 1, upper: 1, tags: ["neuro"], careers: ["healthcare","academia"] },
    { schoolId, code: `${prefix}NEUR401`, name: "Systems Neuroscience", description: "Sensory systems, motor control, cognition.", credits: 4, difficulty: 5, workload: 14, fall: 1, spring: 0, upper: 1, tags: ["neuro","systems"], careers: ["healthcare","academia"] },
    // ── FINANCE / BUSINESS ──
    { schoolId, code: `${prefix}FIN201`, name: "Corporate Finance", description: "Capital structure, valuation, investment decisions.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["finance"], careers: ["finance"] },
    { schoolId, code: `${prefix}FIN301`, name: "Investments", description: "Portfolio theory, asset pricing, derivatives.", credits: 4, difficulty: 4, workload: 12, fall: 1, spring: 1, upper: 1, tags: ["investments","finance"], careers: ["finance"] },
    { schoolId, code: `${prefix}MGMT201`, name: "Principles of Management", description: "Organizational behavior, leadership, strategy.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["management","business"], careers: ["consulting","finance"] },
    // ── ENVIRONMENTAL STUDIES ──
    { schoolId, code: `${prefix}ENV101`, name: "Introduction to Environmental Studies", description: "Ecology, climate change, sustainability.", credits: 4, difficulty: 2, workload: 8, fall: 1, spring: 1, upper: 0, tags: ["environment"], careers: ["academia","engineering"] },
    { schoolId, code: `${prefix}ENV301`, name: "Environmental Policy", description: "Regulatory frameworks, international agreements.", credits: 4, difficulty: 3, workload: 10, fall: 1, spring: 1, upper: 1, tags: ["policy","environment"], careers: ["consulting","academia"] },
    // ── CLASSICS ──
    { schoolId, code: `${prefix}CLAS101`, name: "Ancient Greek I", description: "Introduction to classical Greek language.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 0, upper: 0, tags: ["greek","classics"], careers: ["academia"] },
    { schoolId, code: `${prefix}CLAS201`, name: "Latin I", description: "Introduction to classical Latin language.", credits: 4, difficulty: 3, workload: 12, fall: 1, spring: 0, upper: 0, tags: ["latin","classics"], careers: ["academia"] },
    // ── ARCHITECTURE ──
    { schoolId, code: `${prefix}ARCH101`, name: "Introduction to Architecture", description: "Architectural history, design principles, drawing.", credits: 4, difficulty: 2, workload: 10, fall: 1, spring: 1, upper: 0, tags: ["architecture"], careers: ["engineering","academia"] },
    { schoolId, code: `${prefix}ARCH301`, name: "Architectural Design Studio", description: "Design projects, materials, structural systems.", credits: 6, difficulty: 4, workload: 20, fall: 1, spring: 1, upper: 1, tags: ["design","architecture"], careers: ["engineering"] },
    // ── WRITING / COMPOSITION ──
    { schoolId, code: `${prefix}WR101`, name: "Academic Writing", description: "Essay structure, research, citation.", credits: 4, difficulty: 1, workload: 6, fall: 1, spring: 1, upper: 0, tags: ["writing"], careers: ["consulting","academia"] },
  ];
}

// ─── PREREQUISITE DEFINITIONS (shared logic by course code suffix) ───────────

function buildPrereqMap(courseMap) {
  // Returns array of [courseCode, prereqCode] pairs
  const pairs = [
    // CS chain
    ["CS201", "CS101"],
    ["CS301", "CS201"],
    ["CS302", "CS201"],
    ["CS401", "CS201"],
    ["CS402", "CS401"],
    ["CS403", "CS201"],
    ["CS404", "CS301"],
    ["CS405", "CS201"],
    ["CS406", "CS301"],
    // Math chain
    ["MATH102", "MATH101"],
    ["MATH201", "MATH102"],
    ["MATH202", "MATH101"],
    ["MATH301", "MATH201"],
    ["MATH302", "MATH201"],
    ["MATH401", "MATH301"],
    ["MATH402", "MATH301"],
    // Econ chain
    ["ECON201", "ECON101"],
    ["ECON202", "ECON102"],
    ["ECON301", "ECON201"],
    ["ECON401", "ECON201"],
    // Physics chain
    ["PHYS102", "PHYS101"],
    ["PHYS201", "PHYS102"],
    ["PHYS202", "PHYS102"],
    // Chemistry chain
    ["CHEM102", "CHEM101"],
    ["CHEM201", "CHEM102"],
    ["CHEM202", "CHEM201"],
    // Biology chain
    ["BIO201", "BIO101"],
    ["BIO301", "BIO201"],
    ["BIO401", "BIO301"],
    // Stats chain
    ["STAT201", "STAT101"],
    ["STAT301", "STAT201"],
    ["STAT401", "STAT301"],
    // Psych chain
    ["PSYC201", "PSYC101"],
    ["PSYC301", "PSYC201"],
    ["PSYC401", "PSYC301"],
    // Hist chain
    ["HIST301", "HIST102"],
    // Phil chain
    ["PHIL201", "PHIL101"],
    ["PHIL301", "PHIL201"],
    // Pols chain
    ["POLS201", "POLS101"],
    ["POLS301", "POLS201"],
    // Soc chain
    ["SOC201", "SOC101"],
    // Eng chain
    ["ENG201", "ENG101"],
    ["ENG301", "ENG201"],
    // Engineering chain
    ["ENGR201", "ENGR101"],
    ["ENGR301", "ENGR201"],
    ["ENGR401", "ENGR301"],
    // Ling chain
    ["LING301", "LING101"],
    // Mus chain
    ["MUS201", "MUS101"],
    // Anth chain
    ["ANTH301", "ANTH101"],
    // Neuro chain
    ["NEUR401", "NEUR301"],
    // Finance chain
    ["FIN301", "FIN201"],
    // Cross-discipline
    ["CS402", "MATH302"],
    ["ECON301", "STAT201"],
    ["NEUR301", "BIO301"],
    ["NEUR401", "NEUR301"],
    ["PHYS201", "MATH201"],
    ["PHYS202", "MATH201"],
    ["ENGR301", "PHYS102"],
    ["CHEM201", "MATH101"],
    ["BIO201", "CHEM101"],
    ["STAT301", "MATH202"],
    ["CS401", "MATH202"],
    ["FIN201", "ECON101"],
    ["FIN301", "MATH302"],
    ["ARCH301", "ARCH101"],
  ];
  return pairs;
}

// ─── DEGREE REQUIREMENT TEMPLATES ───────────────────────────────────────────

function getCoreCoursesForMajor(majorName, prefix) {
  const m = majorName.toLowerCase();
  if (m.includes("computer science")) return [
    `${prefix}CS101`,`${prefix}CS201`,`${prefix}CS301`,`${prefix}CS302`,
    `${prefix}CS401`,`${prefix}MATH101`,`${prefix}MATH202`,`${prefix}MATH302`,
  ];
  if (m.includes("mathematics") && !m.includes("applied")) return [
    `${prefix}MATH101`,`${prefix}MATH102`,`${prefix}MATH201`,`${prefix}MATH202`,
    `${prefix}MATH301`,`${prefix}MATH401`,`${prefix}MATH402`,
  ];
  if (m.includes("applied mathematics")) return [
    `${prefix}MATH101`,`${prefix}MATH102`,`${prefix}MATH201`,`${prefix}MATH202`,
    `${prefix}MATH301`,`${prefix}MATH302`,`${prefix}STAT201`,
  ];
  if (m.includes("economics") && !m.includes("computer") && !m.includes("applied")) return [
    `${prefix}ECON101`,`${prefix}ECON102`,`${prefix}ECON201`,`${prefix}ECON202`,
    `${prefix}ECON301`,`${prefix}MATH101`,`${prefix}STAT101`,
  ];
  if (m.includes("physics")) return [
    `${prefix}PHYS101`,`${prefix}PHYS102`,`${prefix}PHYS201`,`${prefix}PHYS202`,
    `${prefix}MATH101`,`${prefix}MATH102`,`${prefix}MATH201`,
  ];
  if (m.includes("chemistry") && !m.includes("computational")) return [
    `${prefix}CHEM101`,`${prefix}CHEM102`,`${prefix}CHEM201`,`${prefix}CHEM202`,
    `${prefix}MATH101`,`${prefix}PHYS101`,
  ];
  if (m.includes("biology") || m.includes("biochemistry") || m.includes("molecular")) return [
    `${prefix}BIO101`,`${prefix}BIO102`,`${prefix}BIO201`,`${prefix}BIO301`,
    `${prefix}CHEM101`,`${prefix}CHEM102`,`${prefix}CHEM201`,
  ];
  if (m.includes("statistics") || m.includes("data science")) return [
    `${prefix}STAT101`,`${prefix}STAT201`,`${prefix}STAT301`,`${prefix}MATH101`,
    `${prefix}MATH202`,`${prefix}CS101`,
  ];
  if (m.includes("psychology")) return [
    `${prefix}PSYC101`,`${prefix}PSYC201`,`${prefix}PSYC301`,`${prefix}STAT101`,
  ];
  if (m.includes("history") && !m.includes("art") && !m.includes("science")) return [
    `${prefix}HIST101`,`${prefix}HIST102`,`${prefix}HIST301`,`${prefix}ENG101`,
  ];
  if (m.includes("philosophy")) return [
    `${prefix}PHIL101`,`${prefix}PHIL201`,`${prefix}PHIL301`,`${prefix}ENG101`,
  ];
  if (m.includes("political") || m.includes("government")) return [
    `${prefix}POLS101`,`${prefix}POLS201`,`${prefix}POLS301`,`${prefix}STAT101`,
  ];
  if (m.includes("sociology")) return [
    `${prefix}SOC101`,`${prefix}SOC201`,`${prefix}STAT101`,`${prefix}ENG101`,
  ];
  if (m.includes("english") || m.includes("literature")) return [
    `${prefix}ENG101`,`${prefix}ENG201`,`${prefix}ENG301`,
  ];
  if (m.includes("neuroscience")) return [
    `${prefix}BIO101`,`${prefix}BIO301`,`${prefix}NEUR301`,`${prefix}NEUR401`,
    `${prefix}CHEM101`,`${prefix}PSYC101`,
  ];
  if (m.includes("linguistics")) return [
    `${prefix}LING101`,`${prefix}LING301`,`${prefix}ENG101`,
  ];
  if (m.includes("music")) return [
    `${prefix}MUS101`,`${prefix}MUS201`,
  ];
  if (m.includes("anthropology")) return [
    `${prefix}ANTH101`,`${prefix}ANTH301`,`${prefix}SOC101`,
  ];
  if (m.includes("architecture")) return [
    `${prefix}ARCH101`,`${prefix}ARCH301`,`${prefix}MATH101`,
  ];
  if (m.includes("finance")) return [
    `${prefix}FIN201`,`${prefix}FIN301`,`${prefix}ECON101`,`${prefix}MATH101`,
  ];
  if (m.includes("engineering") && !m.includes("bio") && !m.includes("chemical") && !m.includes("electrical")) return [
    `${prefix}ENGR101`,`${prefix}ENGR201`,`${prefix}ENGR301`,`${prefix}ENGR401`,
    `${prefix}MATH101`,`${prefix}PHYS101`,
  ];
  if (m.includes("environmental")) return [
    `${prefix}ENV101`,`${prefix}ENV301`,`${prefix}BIO101`,`${prefix}CHEM101`,
  ];
  if (m.includes("classics")) return [
    `${prefix}CLAS101`,`${prefix}CLAS201`,`${prefix}HIST101`,
  ];
  // Default: writing + intro courses
  return [`${prefix}ENG101`,`${prefix}WR101`];
}

// ─── MAIN SEED LOGIC ─────────────────────────────────────────────────────────

console.log("🎓 Starting Ivy League seed...\n");

const schoolPrefixes = {
  "Harvard University":          "HRV",
  "Yale University":             "YLE",
  "Princeton University":        "PRI",
  "Columbia University":         "COL",
  "University of Pennsylvania":  "PEN",
  "Brown University":            "BRN",
  "Dartmouth College":           "DRT",
  "Cornell University":          "COR",
};

const programsBySchool = {
  "Harvard University":          { majors: HARVARD_MAJORS, minors: HARVARD_MINORS },
  "Yale University":             { majors: YALE_MAJORS,    minors: YALE_MINORS },
  "Princeton University":        { majors: PRINCETON_MAJORS, minors: PRINCETON_MINORS },
  "Columbia University":         { majors: COLUMBIA_MAJORS, minors: COLUMBIA_MINORS },
  "University of Pennsylvania":  { majors: PENN_MAJORS,   minors: PENN_MINORS },
  "Brown University":            { majors: BROWN_MAJORS,  minors: BROWN_MINORS },
  "Dartmouth College":           { majors: DARTMOUTH_MAJORS, minors: DARTMOUTH_MINORS },
  "Cornell University":          { majors: CORNELL_MAJORS, minors: CORNELL_MINORS },
};

for (const schoolDef of SCHOOLS) {
  const prefix = schoolPrefixes[schoolDef.name];
  console.log(`\n📚 Seeding ${schoolDef.name} (prefix: ${prefix})...`);

  // 1. Upsert school
  const schoolId = await upsertSchool({
    name: schoolDef.name,
    shortName: schoolDef.shortName,
    location: schoolDef.location,
  });
  console.log(`   School ID: ${schoolId}`);

  // 2. Upsert courses
  const courses = buildCourseSet(schoolId, prefix);
  const courseIdMap = {}; // code -> id
  for (const c of courses) {
    const id = await upsertCourse(c);
    courseIdMap[c.code] = id;
  }
  console.log(`   Courses: ${Object.keys(courseIdMap).length}`);

  // 3. Upsert prerequisites
  const prereqPairs = buildPrereqMap(courseIdMap);
  let prereqCount = 0;
  for (const [courseCode, prereqCode] of prereqPairs) {
    // Find the full code with prefix
    const fullCourse = `${prefix}${courseCode}`;
    const fullPrereq = `${prefix}${prereqCode}`;
    if (courseIdMap[fullCourse] && courseIdMap[fullPrereq]) {
      await addPrereq(courseIdMap[fullCourse], courseIdMap[fullPrereq]);
      prereqCount++;
    }
  }
  console.log(`   Prerequisites: ${prereqCount}`);

  // 4. Upsert programs and degree requirements
  const { majors, minors } = programsBySchool[schoolDef.name];
  let programCount = 0;
  let reqCount = 0;

  for (const majorName of majors) {
    const programId = await upsertProgram({
      schoolId,
      name: majorName,
      shortName: majorName.substring(0, 30),
      type: "major",
      description: `${majorName} concentration at ${schoolDef.shortName}`,
      total: schoolDef.totalCredits,
      core: Math.floor(schoolDef.totalCredits * 0.5),
      elective: Math.floor(schoolDef.totalCredits * 0.25),
    });
    programCount++;

    // Add core degree requirements
    const coreCodes = getCoreCoursesForMajor(majorName, prefix);
    for (const code of coreCodes) {
      if (courseIdMap[code]) {
        await addRequirement(programId, courseIdMap[code], "Core", true);
        reqCount++;
      }
    }
    // Add writing requirement
    if (courseIdMap[`${prefix}WR101`]) {
      await addRequirement(programId, courseIdMap[`${prefix}WR101`], "Writing Requirement", true);
      reqCount++;
    }
  }

  for (const minorName of minors) {
    await upsertProgram({
      schoolId,
      name: minorName,
      shortName: minorName.substring(0, 30),
      type: "minor",
      description: `${minorName} secondary field at ${schoolDef.shortName}`,
      total: 20,
      core: 16,
      elective: 4,
    });
    programCount++;
  }

  console.log(`   Programs: ${programCount} (${majors.length} majors + ${minors.length} minors)`);
  console.log(`   Degree requirements: ${reqCount}`);
}

console.log("\n✅ Ivy League seed complete!");
await db.end();

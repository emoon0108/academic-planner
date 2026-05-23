/**
 * seed_fix.mjs
 * Fixes the Ivy League course catalogs so each major has enough courses
 * to fill a proper 120-credit, 8-semester degree plan.
 *
 * Strategy:
 * 1. Clear existing Ivy League courses, prerequisites, requirement_categories,
 *    and degree_requirements for all 8 Ivy schools.
 * 2. For each school, create a rich shared course pool (~200 courses) covering
 *    the major disciplines: CS, Economics, Mathematics, Biology, Chemistry,
 *    Physics, English, History, Psychology, Political Science, Sociology,
 *    Philosophy, Engineering, Business/Finance, Neuroscience, Art History,
 *    Linguistics, Environmental Science, Anthropology, and more.
 * 3. For each program (major/minor), assign 28-32 required/elective courses
 *    from the pool, organized into 4-5 categories totaling 120 credits.
 * 4. Create proper prerequisite chains (intro → intermediate → advanced).
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function q(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function insert(table, obj) {
  const keys = Object.keys(obj);
  const vals = Object.values(obj);
  const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const [res] = await conn.execute(sql, vals);
  return res.insertId;
}

async function insertIgnore(table, obj) {
  const keys = Object.keys(obj);
  const vals = Object.values(obj);
  const sql = `INSERT IGNORE INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const [res] = await conn.execute(sql, vals);
  return res.insertId;
}

// ─── School IDs ──────────────────────────────────────────────────────────────

const [schools] = await conn.execute('SELECT id, name FROM schools WHERE name IN (?,?,?,?,?,?,?,?)', [
  'Harvard University', 'Yale University', 'Princeton University', 'Columbia University',
  'University of Pennsylvania', 'Brown University', 'Dartmouth College', 'Cornell University'
]);
const schoolMap = {};
for (const s of schools) schoolMap[s.name] = s.id;
console.log('Schools:', Object.entries(schoolMap).map(([n,id]) => `${n}=${id}`).join(', '));

// ─── Clear existing Ivy data ─────────────────────────────────────────────────

const ivyIds = Object.values(schoolMap);
console.log('\nClearing existing Ivy League data...');

// Get all program IDs for Ivy schools
const [ivyPrograms] = await conn.execute(
  `SELECT id FROM programs WHERE schoolId IN (${ivyIds.map(() => '?').join(',')})`,
  ivyIds
);
const ivyProgramIds = ivyPrograms.map(p => p.id);

if (ivyProgramIds.length > 0) {
  // Get all category IDs
  const [ivyCats] = await conn.execute(
    `SELECT id FROM requirement_categories WHERE programId IN (${ivyProgramIds.map(() => '?').join(',')})`,
    ivyProgramIds
  );
  const ivyCatIds = ivyCats.map(c => c.id);
  
  if (ivyCatIds.length > 0) {
    // Delete degree_requirements
    await conn.execute(
      `DELETE FROM degree_requirements WHERE categoryId IN (${ivyCatIds.map(() => '?').join(',')})`,
      ivyCatIds
    );
    // Delete requirement_categories
    await conn.execute(
      `DELETE FROM requirement_categories WHERE id IN (${ivyCatIds.map(() => '?').join(',')})`,
      ivyCatIds
    );
  }
}

// Delete prerequisites for Ivy courses
const [ivyCourses] = await conn.execute(
  `SELECT id FROM courses WHERE schoolId IN (${ivyIds.map(() => '?').join(',')})`,
  ivyIds
);
const ivyCourseIds = ivyCourses.map(c => c.id);

if (ivyCourseIds.length > 0) {
  const chunks = [];
  for (let i = 0; i < ivyCourseIds.length; i += 500) chunks.push(ivyCourseIds.slice(i, i + 500));
  for (const chunk of chunks) {
    await conn.execute(
      `DELETE FROM prerequisites WHERE courseId IN (${chunk.map(() => '?').join(',')}) OR prerequisiteCourseId IN (${chunk.map(() => '?').join(',')})`,
      [...chunk, ...chunk]
    );
  }
  // Delete courses
  for (const chunk of chunks) {
    await conn.execute(
      `DELETE FROM courses WHERE id IN (${chunk.map(() => '?').join(',')})`,
      chunk
    );
  }
}

console.log('Cleared existing Ivy data.');

// ─── Course Template Library ─────────────────────────────────────────────────
// Each entry: [code_suffix, name, credits, difficulty(1-5), workloadHours, availFall, availSpring, isUpper, tags, careerTracks]
// We'll prefix code_suffix with a school prefix per school.

const COURSE_TEMPLATES = {
  // ── Computer Science ──
  cs: [
    ['CS101', 'Introduction to Computer Science', 4, 2, 8, 1, 1, 0, '["programming","fundamentals"]', '["software_engineering","data_science"]'],
    ['CS102', 'Programming Fundamentals', 4, 2, 10, 1, 1, 0, '["programming","python"]', '["software_engineering"]'],
    ['CS201', 'Data Structures', 4, 3, 12, 1, 1, 0, '["data_structures","algorithms"]', '["software_engineering","data_science"]'],
    ['CS202', 'Discrete Mathematics', 4, 3, 10, 1, 1, 0, '["mathematics","logic"]', '["software_engineering","research"]'],
    ['CS211', 'Computer Organization', 4, 3, 12, 1, 0, 0, '["systems","hardware"]', '["software_engineering"]'],
    ['CS301', 'Algorithms', 4, 4, 14, 1, 1, 1, '["algorithms","complexity"]', '["software_engineering","research"]'],
    ['CS302', 'Operating Systems', 4, 4, 14, 1, 0, 1, '["systems","os"]', '["software_engineering"]'],
    ['CS311', 'Programming Languages', 4, 4, 12, 0, 1, 1, '["languages","theory"]', '["software_engineering","research"]'],
    ['CS321', 'Software Engineering', 4, 3, 12, 1, 1, 1, '["software","design"]', '["software_engineering","product"]'],
    ['CS331', 'Database Systems', 4, 3, 12, 1, 1, 1, '["databases","sql"]', '["software_engineering","data_science"]'],
    ['CS341', 'Computer Networks', 4, 3, 12, 1, 0, 1, '["networks","distributed"]', '["software_engineering"]'],
    ['CS351', 'Artificial Intelligence', 4, 4, 14, 1, 1, 1, '["ai","machine_learning"]', '["data_science","research"]'],
    ['CS361', 'Machine Learning', 4, 4, 16, 0, 1, 1, '["ml","statistics"]', '["data_science","research"]'],
    ['CS371', 'Computer Graphics', 4, 3, 12, 1, 0, 1, '["graphics","visualization"]', '["software_engineering"]'],
    ['CS381', 'Theory of Computation', 4, 5, 14, 1, 0, 1, '["theory","automata"]', '["research"]'],
    ['CS391', 'Compilers', 4, 5, 16, 0, 1, 1, '["compilers","languages"]', '["software_engineering","research"]'],
    ['CS401', 'Distributed Systems', 4, 5, 16, 1, 0, 1, '["distributed","systems"]', '["software_engineering"]'],
    ['CS411', 'Computer Security', 4, 4, 14, 1, 1, 1, '["security","cryptography"]', '["software_engineering"]'],
    ['CS421', 'Natural Language Processing', 4, 4, 14, 0, 1, 1, '["nlp","ai"]', '["data_science","research"]'],
    ['CS431', 'Deep Learning', 4, 5, 18, 1, 0, 1, '["deep_learning","neural_networks"]', '["data_science","research"]'],
    ['CS491', 'Senior Capstone I', 4, 4, 16, 1, 0, 1, '["capstone","project"]', '["software_engineering"]'],
    ['CS492', 'Senior Capstone II', 4, 4, 16, 0, 1, 1, '["capstone","project"]', '["software_engineering"]'],
  ],

  // ── Economics ──
  econ: [
    ['ECON101', 'Principles of Microeconomics', 4, 2, 8, 1, 1, 0, '["microeconomics","markets"]', '["finance","consulting"]'],
    ['ECON102', 'Principles of Macroeconomics', 4, 2, 8, 1, 1, 0, '["macroeconomics","policy"]', '["finance","consulting"]'],
    ['ECON201', 'Intermediate Microeconomics', 4, 3, 10, 1, 1, 0, '["microeconomics","theory"]', '["finance","research"]'],
    ['ECON202', 'Intermediate Macroeconomics', 4, 3, 10, 1, 1, 0, '["macroeconomics","theory"]', '["finance","research"]'],
    ['ECON211', 'Statistics for Economists', 4, 3, 10, 1, 1, 0, '["statistics","econometrics"]', '["finance","data_science"]'],
    ['ECON301', 'Econometrics', 4, 4, 14, 1, 1, 1, '["econometrics","regression"]', '["finance","research"]'],
    ['ECON311', 'Game Theory', 4, 4, 12, 1, 0, 1, '["game_theory","strategy"]', '["consulting","research"]'],
    ['ECON321', 'Industrial Organization', 4, 4, 12, 0, 1, 1, '["io","markets"]', '["consulting","finance"]'],
    ['ECON331', 'Public Economics', 4, 3, 10, 1, 0, 1, '["public","policy"]', '["consulting","policy"]'],
    ['ECON341', 'International Trade', 4, 3, 10, 0, 1, 1, '["trade","globalization"]', '["consulting","finance"]'],
    ['ECON351', 'Development Economics', 4, 3, 10, 1, 0, 1, '["development","poverty"]', '["policy","research"]'],
    ['ECON361', 'Labor Economics', 4, 3, 10, 0, 1, 1, '["labor","wages"]', '["policy","consulting"]'],
    ['ECON371', 'Financial Economics', 4, 4, 12, 1, 1, 1, '["finance","markets"]', '["finance"]'],
    ['ECON381', 'Behavioral Economics', 4, 3, 10, 1, 0, 1, '["behavioral","psychology"]', '["consulting","research"]'],
    ['ECON401', 'Advanced Microeconomics', 4, 5, 16, 1, 0, 1, '["micro","theory"]', '["research","finance"]'],
    ['ECON402', 'Advanced Macroeconomics', 4, 5, 16, 0, 1, 1, '["macro","theory"]', '["research","finance"]'],
    ['ECON411', 'Time Series Econometrics', 4, 5, 16, 1, 0, 1, '["econometrics","time_series"]', '["finance","research"]'],
    ['ECON491', 'Senior Thesis I', 4, 4, 16, 1, 0, 1, '["thesis","research"]', '["research"]'],
    ['ECON492', 'Senior Thesis II', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Mathematics ──
  math: [
    ['MATH101', 'Calculus I', 4, 2, 10, 1, 1, 0, '["calculus","limits"]', '["research","data_science"]'],
    ['MATH102', 'Calculus II', 4, 2, 10, 1, 1, 0, '["calculus","integration"]', '["research","data_science"]'],
    ['MATH201', 'Multivariable Calculus', 4, 3, 12, 1, 1, 0, '["calculus","multivariable"]', '["research"]'],
    ['MATH202', 'Linear Algebra', 4, 3, 12, 1, 1, 0, '["linear_algebra","vectors"]', '["research","data_science"]'],
    ['MATH211', 'Differential Equations', 4, 3, 12, 1, 1, 0, '["odes","differential"]', '["research"]'],
    ['MATH221', 'Probability Theory', 4, 3, 12, 1, 1, 1, '["probability","statistics"]', '["data_science","finance"]'],
    ['MATH301', 'Real Analysis', 4, 5, 16, 1, 0, 1, '["analysis","proofs"]', '["research"]'],
    ['MATH302', 'Abstract Algebra', 4, 5, 16, 0, 1, 1, '["algebra","groups"]', '["research"]'],
    ['MATH311', 'Complex Analysis', 4, 4, 14, 1, 0, 1, '["complex","analysis"]', '["research"]'],
    ['MATH321', 'Topology', 4, 5, 16, 0, 1, 1, '["topology","spaces"]', '["research"]'],
    ['MATH331', 'Number Theory', 4, 4, 14, 1, 0, 1, '["number_theory","primes"]', '["research"]'],
    ['MATH341', 'Numerical Analysis', 4, 4, 14, 0, 1, 1, '["numerical","computation"]', '["research","data_science"]'],
    ['MATH351', 'Mathematical Statistics', 4, 4, 14, 1, 1, 1, '["statistics","inference"]', '["data_science","research"]'],
    ['MATH401', 'Graduate Analysis', 4, 5, 18, 1, 0, 1, '["analysis","graduate"]', '["research"]'],
    ['MATH491', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['MATH492', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Biology ──
  bio: [
    ['BIO101', 'Principles of Biology I', 4, 2, 10, 1, 1, 0, '["biology","cells"]', '["medicine","research"]'],
    ['BIO102', 'Principles of Biology II', 4, 2, 10, 1, 1, 0, '["biology","evolution"]', '["medicine","research"]'],
    ['BIO201', 'Genetics', 4, 3, 12, 1, 1, 0, '["genetics","dna"]', '["medicine","research"]'],
    ['BIO202', 'Cell Biology', 4, 3, 12, 1, 1, 0, '["cell_biology","organelles"]', '["medicine","research"]'],
    ['BIO211', 'Ecology', 4, 3, 10, 1, 0, 0, '["ecology","environment"]', '["research"]'],
    ['BIO221', 'Biochemistry I', 4, 4, 14, 1, 1, 1, '["biochemistry","proteins"]', '["medicine","research"]'],
    ['BIO301', 'Molecular Biology', 4, 4, 14, 1, 1, 1, '["molecular","gene_expression"]', '["medicine","research"]'],
    ['BIO311', 'Developmental Biology', 4, 4, 12, 0, 1, 1, '["development","embryology"]', '["medicine","research"]'],
    ['BIO321', 'Neuroscience', 4, 4, 14, 1, 0, 1, '["neuroscience","brain"]', '["medicine","research"]'],
    ['BIO331', 'Immunology', 4, 4, 14, 0, 1, 1, '["immunology","immune"]', '["medicine","research"]'],
    ['BIO341', 'Microbiology', 4, 3, 12, 1, 0, 1, '["microbiology","bacteria"]', '["medicine","research"]'],
    ['BIO351', 'Evolutionary Biology', 4, 3, 12, 0, 1, 1, '["evolution","phylogenetics"]', '["research"]'],
    ['BIO401', 'Genomics', 4, 5, 16, 1, 0, 1, '["genomics","bioinformatics"]', '["medicine","research","data_science"]'],
    ['BIO411', 'Systems Biology', 4, 5, 16, 0, 1, 1, '["systems","modeling"]', '["research","data_science"]'],
    ['BIO491', 'Senior Research I', 4, 4, 16, 1, 0, 1, '["research","thesis"]', '["research","medicine"]'],
    ['BIO492', 'Senior Research II', 4, 4, 16, 0, 1, 1, '["research","thesis"]', '["research","medicine"]'],
  ],

  // ── Chemistry ──
  chem: [
    ['CHEM101', 'General Chemistry I', 4, 2, 10, 1, 1, 0, '["chemistry","atoms"]', '["medicine","research"]'],
    ['CHEM102', 'General Chemistry II', 4, 2, 10, 1, 1, 0, '["chemistry","reactions"]', '["medicine","research"]'],
    ['CHEM201', 'Organic Chemistry I', 4, 4, 16, 1, 1, 0, '["organic","synthesis"]', '["medicine","research"]'],
    ['CHEM202', 'Organic Chemistry II', 4, 4, 16, 1, 1, 1, '["organic","mechanisms"]', '["medicine","research"]'],
    ['CHEM211', 'Analytical Chemistry', 4, 3, 12, 1, 0, 1, '["analytical","instrumentation"]', '["research"]'],
    ['CHEM301', 'Physical Chemistry I', 4, 4, 14, 1, 1, 1, '["physical","thermodynamics"]', '["research"]'],
    ['CHEM302', 'Physical Chemistry II', 4, 4, 14, 0, 1, 1, '["physical","quantum"]', '["research"]'],
    ['CHEM311', 'Inorganic Chemistry', 4, 3, 12, 1, 0, 1, '["inorganic","coordination"]', '["research"]'],
    ['CHEM321', 'Biochemistry', 4, 4, 14, 0, 1, 1, '["biochemistry","metabolism"]', '["medicine","research"]'],
    ['CHEM401', 'Advanced Organic Chemistry', 4, 5, 18, 1, 0, 1, '["organic","advanced"]', '["research"]'],
    ['CHEM491', 'Research I', 4, 4, 16, 1, 0, 1, '["research","thesis"]', '["research"]'],
    ['CHEM492', 'Research II', 4, 4, 16, 0, 1, 1, '["research","thesis"]', '["research"]'],
  ],

  // ── Physics ──
  phys: [
    ['PHYS101', 'Mechanics', 4, 3, 12, 1, 1, 0, '["mechanics","kinematics"]', '["research","engineering"]'],
    ['PHYS102', 'Electricity and Magnetism', 4, 3, 12, 1, 1, 0, '["electromagnetism","circuits"]', '["research","engineering"]'],
    ['PHYS201', 'Waves and Optics', 4, 3, 12, 1, 0, 0, '["waves","optics"]', '["research"]'],
    ['PHYS202', 'Thermodynamics', 4, 3, 12, 0, 1, 0, '["thermodynamics","heat"]', '["research","engineering"]'],
    ['PHYS211', 'Modern Physics', 4, 4, 14, 1, 1, 1, '["quantum","relativity"]', '["research"]'],
    ['PHYS301', 'Quantum Mechanics I', 4, 5, 16, 1, 0, 1, '["quantum","wavefunctions"]', '["research"]'],
    ['PHYS302', 'Quantum Mechanics II', 4, 5, 16, 0, 1, 1, '["quantum","operators"]', '["research"]'],
    ['PHYS311', 'Classical Mechanics', 4, 4, 14, 1, 0, 1, '["mechanics","lagrangian"]', '["research"]'],
    ['PHYS321', 'Electrodynamics', 4, 5, 16, 0, 1, 1, '["electrodynamics","maxwell"]', '["research"]'],
    ['PHYS331', 'Statistical Mechanics', 4, 4, 14, 1, 0, 1, '["statistical","entropy"]', '["research"]'],
    ['PHYS401', 'Particle Physics', 4, 5, 16, 1, 0, 1, '["particle","standard_model"]', '["research"]'],
    ['PHYS491', 'Senior Thesis I', 4, 4, 16, 1, 0, 1, '["thesis","research"]', '["research"]'],
    ['PHYS492', 'Senior Thesis II', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── English ──
  engl: [
    ['ENGL101', 'Writing and Rhetoric', 4, 1, 8, 1, 1, 0, '["writing","rhetoric"]', '["consulting","policy"]'],
    ['ENGL102', 'Introduction to Literature', 4, 1, 8, 1, 1, 0, '["literature","reading"]', '[]'],
    ['ENGL201', 'British Literature I', 4, 2, 10, 1, 1, 0, '["british","medieval"]', '[]'],
    ['ENGL202', 'American Literature I', 4, 2, 10, 1, 1, 0, '["american","19th_century"]', '[]'],
    ['ENGL211', 'World Literature', 4, 2, 10, 1, 0, 0, '["world","comparative"]', '[]'],
    ['ENGL221', 'Creative Writing', 4, 2, 8, 0, 1, 0, '["creative","fiction"]', '[]'],
    ['ENGL301', 'Literary Theory', 4, 4, 12, 1, 0, 1, '["theory","criticism"]', '["research"]'],
    ['ENGL311', 'Shakespeare', 4, 3, 10, 0, 1, 1, '["shakespeare","drama"]', '[]'],
    ['ENGL321', 'Modern Poetry', 4, 3, 10, 1, 0, 1, '["poetry","modernism"]', '[]'],
    ['ENGL331', 'Postcolonial Literature', 4, 3, 10, 0, 1, 1, '["postcolonial","global"]', '[]'],
    ['ENGL341', 'The Novel', 4, 3, 10, 1, 0, 1, '["novel","narrative"]', '[]'],
    ['ENGL401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['ENGL491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── History ──
  hist: [
    ['HIST101', 'World History I', 4, 1, 8, 1, 1, 0, '["world","ancient"]', '["policy","consulting"]'],
    ['HIST102', 'World History II', 4, 1, 8, 1, 1, 0, '["world","modern"]', '["policy","consulting"]'],
    ['HIST201', 'U.S. History I', 4, 2, 10, 1, 1, 0, '["us","colonial"]', '["policy"]'],
    ['HIST202', 'U.S. History II', 4, 2, 10, 1, 1, 0, '["us","modern"]', '["policy"]'],
    ['HIST211', 'European History', 4, 2, 10, 1, 0, 0, '["europe","modern"]', '["policy"]'],
    ['HIST221', 'East Asian History', 4, 2, 10, 0, 1, 0, '["asia","china"]', '[]'],
    ['HIST301', 'Historical Methods', 4, 3, 12, 1, 0, 1, '["methods","archives"]', '["research"]'],
    ['HIST311', 'The Cold War', 4, 3, 10, 0, 1, 1, '["cold_war","diplomacy"]', '["policy"]'],
    ['HIST321', 'Colonial and Postcolonial History', 4, 3, 10, 1, 0, 1, '["colonial","empire"]', '["policy"]'],
    ['HIST331', 'History of Science', 4, 3, 10, 0, 1, 1, '["science","intellectual"]', '["research"]'],
    ['HIST401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['HIST491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Psychology ──
  psyc: [
    ['PSYC101', 'Introduction to Psychology', 4, 1, 8, 1, 1, 0, '["psychology","behavior"]', '["medicine","consulting"]'],
    ['PSYC201', 'Research Methods', 4, 3, 12, 1, 1, 0, '["methods","statistics"]', '["research"]'],
    ['PSYC211', 'Cognitive Psychology', 4, 3, 10, 1, 1, 0, '["cognition","memory"]', '["research","medicine"]'],
    ['PSYC221', 'Social Psychology', 4, 2, 10, 1, 1, 0, '["social","attitudes"]', '["consulting","policy"]'],
    ['PSYC231', 'Developmental Psychology', 4, 2, 10, 1, 0, 0, '["development","children"]', '["medicine"]'],
    ['PSYC241', 'Abnormal Psychology', 4, 2, 10, 0, 1, 0, '["abnormal","disorders"]', '["medicine"]'],
    ['PSYC301', 'Neuroscience', 4, 4, 14, 1, 0, 1, '["neuroscience","brain"]', '["medicine","research"]'],
    ['PSYC311', 'Personality Psychology', 4, 3, 10, 0, 1, 1, '["personality","traits"]', '["consulting"]'],
    ['PSYC321', 'Health Psychology', 4, 3, 10, 1, 0, 1, '["health","behavior"]', '["medicine"]'],
    ['PSYC331', 'Industrial-Organizational Psychology', 4, 3, 10, 0, 1, 1, '["io","workplace"]', '["consulting"]'],
    ['PSYC401', 'Advanced Research', 4, 4, 16, 1, 0, 1, '["research","advanced"]', '["research"]'],
    ['PSYC491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Political Science ──
  pols: [
    ['POLS101', 'Introduction to Political Science', 4, 1, 8, 1, 1, 0, '["politics","government"]', '["policy","consulting"]'],
    ['POLS201', 'American Government', 4, 2, 10, 1, 1, 0, '["american","institutions"]', '["policy"]'],
    ['POLS211', 'Comparative Politics', 4, 2, 10, 1, 1, 0, '["comparative","regimes"]', '["policy","consulting"]'],
    ['POLS221', 'International Relations', 4, 2, 10, 1, 1, 0, '["ir","diplomacy"]', '["policy","consulting"]'],
    ['POLS231', 'Political Theory', 4, 3, 10, 1, 0, 0, '["theory","philosophy"]', '["research","policy"]'],
    ['POLS301', 'Research Methods', 4, 3, 12, 1, 0, 1, '["methods","quantitative"]', '["research"]'],
    ['POLS311', 'Congress and the Presidency', 4, 3, 10, 0, 1, 1, '["congress","executive"]', '["policy"]'],
    ['POLS321', 'Foreign Policy', 4, 3, 10, 1, 0, 1, '["foreign_policy","security"]', '["policy","consulting"]'],
    ['POLS331', 'Political Economy', 4, 3, 10, 0, 1, 1, '["political_economy","institutions"]', '["finance","policy"]'],
    ['POLS401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['POLS491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research","policy"]'],
  ],

  // ── Philosophy ──
  phil: [
    ['PHIL101', 'Introduction to Philosophy', 4, 1, 8, 1, 1, 0, '["philosophy","logic"]', '["consulting","research"]'],
    ['PHIL201', 'Logic', 4, 3, 10, 1, 1, 0, '["logic","reasoning"]', '["research"]'],
    ['PHIL211', 'Ethics', 4, 2, 8, 1, 1, 0, '["ethics","morality"]', '["policy","consulting"]'],
    ['PHIL221', 'Epistemology', 4, 3, 10, 1, 0, 0, '["epistemology","knowledge"]', '["research"]'],
    ['PHIL231', 'Metaphysics', 4, 3, 10, 0, 1, 0, '["metaphysics","ontology"]', '["research"]'],
    ['PHIL301', 'Philosophy of Mind', 4, 4, 12, 1, 0, 1, '["mind","consciousness"]', '["research"]'],
    ['PHIL311', 'Philosophy of Science', 4, 4, 12, 0, 1, 1, '["science","methodology"]', '["research"]'],
    ['PHIL321', 'Political Philosophy', 4, 3, 10, 1, 0, 1, '["political","justice"]', '["policy","research"]'],
    ['PHIL401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['PHIL491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Statistics ──
  stat: [
    ['STAT101', 'Introduction to Statistics', 4, 2, 8, 1, 1, 0, '["statistics","probability"]', '["data_science","research","finance"]'],
    ['STAT201', 'Probability Theory', 4, 3, 12, 1, 1, 0, '["probability","distributions"]', '["data_science","research"]'],
    ['STAT211', 'Statistical Inference', 4, 3, 12, 1, 1, 1, '["inference","hypothesis"]', '["data_science","research"]'],
    ['STAT301', 'Regression Analysis', 4, 4, 14, 1, 0, 1, '["regression","modeling"]', '["data_science","finance"]'],
    ['STAT311', 'Bayesian Statistics', 4, 4, 14, 0, 1, 1, '["bayesian","mcmc"]', '["data_science","research"]'],
    ['STAT321', 'Time Series', 4, 4, 14, 1, 0, 1, '["time_series","forecasting"]', '["finance","data_science"]'],
    ['STAT401', 'Advanced Statistical Theory', 4, 5, 16, 1, 0, 1, '["theory","advanced"]', '["research"]'],
    ['STAT491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research","data_science"]'],
  ],

  // ── Sociology ──
  soc: [
    ['SOC101', 'Introduction to Sociology', 4, 1, 8, 1, 1, 0, '["sociology","society"]', '["policy","consulting"]'],
    ['SOC201', 'Social Theory', 4, 3, 10, 1, 1, 0, '["theory","classical"]', '["research"]'],
    ['SOC211', 'Research Methods', 4, 3, 12, 1, 0, 0, '["methods","surveys"]', '["research"]'],
    ['SOC221', 'Social Stratification', 4, 2, 10, 0, 1, 0, '["inequality","class"]', '["policy"]'],
    ['SOC301', 'Race and Ethnicity', 4, 3, 10, 1, 0, 1, '["race","ethnicity"]', '["policy"]'],
    ['SOC311', 'Gender and Society', 4, 3, 10, 0, 1, 1, '["gender","feminism"]', '["policy"]'],
    ['SOC321', 'Urban Sociology', 4, 3, 10, 1, 0, 1, '["urban","cities"]', '["policy"]'],
    ['SOC401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['SOC491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Neuroscience ──
  neur: [
    ['NEUR101', 'Introduction to Neuroscience', 4, 2, 10, 1, 1, 0, '["neuroscience","brain"]', '["medicine","research"]'],
    ['NEUR201', 'Cellular Neuroscience', 4, 3, 12, 1, 1, 0, '["cellular","neurons"]', '["medicine","research"]'],
    ['NEUR211', 'Systems Neuroscience', 4, 3, 12, 1, 0, 1, '["systems","circuits"]', '["medicine","research"]'],
    ['NEUR301', 'Cognitive Neuroscience', 4, 4, 14, 0, 1, 1, '["cognitive","imaging"]', '["medicine","research"]'],
    ['NEUR311', 'Computational Neuroscience', 4, 4, 14, 1, 0, 1, '["computational","modeling"]', '["research","data_science"]'],
    ['NEUR321', 'Neurological Disorders', 4, 3, 12, 0, 1, 1, '["disorders","clinical"]', '["medicine"]'],
    ['NEUR401', 'Advanced Topics', 4, 5, 16, 1, 0, 1, '["advanced","research"]', '["research","medicine"]'],
    ['NEUR491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── Environmental Science ──
  envs: [
    ['ENVS101', 'Introduction to Environmental Science', 4, 2, 8, 1, 1, 0, '["environment","ecology"]', '["policy","research"]'],
    ['ENVS201', 'Ecology', 4, 3, 10, 1, 1, 0, '["ecology","ecosystems"]', '["research"]'],
    ['ENVS211', 'Climate Science', 4, 3, 10, 1, 0, 1, '["climate","atmosphere"]', '["policy","research"]'],
    ['ENVS221', 'Environmental Policy', 4, 2, 10, 0, 1, 1, '["policy","regulation"]', '["policy","consulting"]'],
    ['ENVS301', 'Conservation Biology', 4, 3, 12, 1, 0, 1, '["conservation","biodiversity"]', '["research","policy"]'],
    ['ENVS311', 'Environmental Chemistry', 4, 4, 14, 0, 1, 1, '["chemistry","pollution"]', '["research"]'],
    ['ENVS401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['ENVS491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research","policy"]'],
  ],

  // ── Anthropology ──
  anth: [
    ['ANTH101', 'Introduction to Anthropology', 4, 1, 8, 1, 1, 0, '["anthropology","culture"]', '["research","policy"]'],
    ['ANTH201', 'Cultural Anthropology', 4, 2, 10, 1, 1, 0, '["cultural","ethnography"]', '["research"]'],
    ['ANTH211', 'Biological Anthropology', 4, 2, 10, 1, 0, 0, '["biological","evolution"]', '["research"]'],
    ['ANTH221', 'Archaeology', 4, 2, 10, 0, 1, 0, '["archaeology","material"]', '["research"]'],
    ['ANTH301', 'Ethnographic Methods', 4, 3, 12, 1, 0, 1, '["methods","fieldwork"]', '["research"]'],
    ['ANTH311', 'Medical Anthropology', 4, 3, 10, 0, 1, 1, '["medical","health"]', '["medicine","research"]'],
    ['ANTH401', 'Senior Seminar', 4, 4, 14, 1, 0, 1, '["seminar","research"]', '["research"]'],
    ['ANTH491', 'Senior Thesis', 4, 4, 16, 0, 1, 1, '["thesis","research"]', '["research"]'],
  ],

  // ── General Education (shared across all majors) ──
  gen: [
    ['GEN101', 'Freshman Seminar', 2, 1, 4, 1, 0, 0, '["seminar","writing"]', '[]'],
    ['GEN102', 'Academic Writing', 4, 1, 6, 1, 1, 0, '["writing","communication"]', '["consulting","policy"]'],
    ['GEN111', 'Quantitative Reasoning', 4, 2, 8, 1, 1, 0, '["quantitative","reasoning"]', '["data_science"]'],
    ['GEN121', 'Ethics and Society', 4, 2, 8, 1, 1, 0, '["ethics","society"]', '["policy","consulting"]'],
    ['GEN131', 'Foreign Language I', 4, 2, 8, 1, 1, 0, '["language","communication"]', '[]'],
    ['GEN132', 'Foreign Language II', 4, 2, 8, 1, 1, 0, '["language","advanced"]', '[]'],
    ['GEN201', 'Arts and Humanities Elective', 4, 2, 8, 1, 1, 0, '["arts","humanities"]', '[]'],
    ['GEN211', 'Social Science Elective', 4, 2, 8, 1, 1, 0, '["social_science","elective"]', '[]'],
    ['GEN221', 'Natural Science Elective', 4, 2, 8, 1, 1, 0, '["science","elective"]', '[]'],
  ],

  // ── Architecture ──
  arch: [
    ['ARCH101', 'Introduction to Architecture', 4, 2, 10, 1, 1, 0, '["architecture","design"]', '["consulting"]'],
    ['ARCH111', 'Architectural Drawing', 4, 2, 10, 1, 1, 0, '["drawing","representation"]', '[]'],
    ['ARCH201', 'Architectural Design Studio I', 6, 3, 18, 1, 0, 0, '["studio","design"]', '[]'],
    ['ARCH202', 'Architectural Design Studio II', 6, 3, 18, 0, 1, 0, '["studio","design"]', '[]'],
    ['ARCH211', 'History of Architecture I', 4, 2, 10, 1, 0, 0, '["history","ancient"]', '[]'],
    ['ARCH212', 'History of Architecture II', 4, 2, 10, 0, 1, 0, '["history","modern"]', '[]'],
    ['ARCH221', 'Structures I', 4, 3, 12, 1, 0, 0, '["structures","engineering"]', '[]'],
    ['ARCH222', 'Structures II', 4, 3, 12, 0, 1, 0, '["structures","materials"]', '[]'],
    ['ARCH301', 'Advanced Design Studio I', 6, 4, 22, 1, 0, 1, '["studio","advanced"]', '[]'],
    ['ARCH302', 'Advanced Design Studio II', 6, 4, 22, 0, 1, 1, '["studio","advanced"]', '[]'],
    ['ARCH311', 'Environmental Systems', 4, 3, 12, 1, 0, 1, '["environment","systems"]', '[]'],
    ['ARCH321', 'Urban Design', 4, 3, 12, 0, 1, 1, '["urban","planning"]', '["policy"]'],
    ['ARCH401', 'Thesis Studio I', 6, 5, 24, 1, 0, 1, '["thesis","design"]', '[]'],
    ['ARCH402', 'Thesis Studio II', 6, 5, 24, 0, 1, 1, '["thesis","design"]', '[]'],
  ],

  // ── Engineering (general) ──
  engr: [
    ['ENGR101', 'Introduction to Engineering', 4, 2, 10, 1, 1, 0, '["engineering","design"]', '["software_engineering","research"]'],
    ['ENGR111', 'Engineering Mathematics', 4, 3, 12, 1, 1, 0, '["mathematics","engineering"]', '["research"]'],
    ['ENGR201', 'Statics', 4, 3, 12, 1, 0, 0, '["statics","mechanics"]', '[]'],
    ['ENGR202', 'Dynamics', 4, 3, 12, 0, 1, 0, '["dynamics","motion"]', '[]'],
    ['ENGR211', 'Thermodynamics', 4, 3, 12, 1, 1, 1, '["thermodynamics","energy"]', '[]'],
    ['ENGR221', 'Circuits', 4, 3, 12, 1, 1, 0, '["circuits","electronics"]', '["software_engineering"]'],
    ['ENGR301', 'Materials Science', 4, 3, 12, 1, 0, 1, '["materials","properties"]', '[]'],
    ['ENGR311', 'Fluid Mechanics', 4, 4, 14, 0, 1, 1, '["fluids","flow"]', '[]'],
    ['ENGR321', 'Control Systems', 4, 4, 14, 1, 0, 1, '["control","feedback"]', '["software_engineering"]'],
    ['ENGR401', 'Capstone Design I', 4, 4, 16, 1, 0, 1, '["capstone","design"]', '[]'],
    ['ENGR402', 'Capstone Design II', 4, 4, 16, 0, 1, 1, '["capstone","design"]', '[]'],
  ],
};

// ─── Prerequisite chains per discipline ──────────────────────────────────────
// [courseCodeSuffix, prerequisiteCodeSuffix]
const PREREQ_CHAINS = {
  cs: [
    ['CS102', 'CS101'], ['CS201', 'CS102'], ['CS202', 'CS101'],
    ['CS211', 'CS201'], ['CS301', 'CS201'], ['CS301', 'CS202'],
    ['CS302', 'CS211'], ['CS311', 'CS201'], ['CS321', 'CS201'],
    ['CS331', 'CS201'], ['CS341', 'CS201'], ['CS351', 'CS301'],
    ['CS361', 'CS351'], ['CS371', 'CS201'], ['CS381', 'CS202'],
    ['CS391', 'CS311'], ['CS401', 'CS302'], ['CS411', 'CS302'],
    ['CS421', 'CS351'], ['CS431', 'CS361'], ['CS491', 'CS301'],
    ['CS492', 'CS491'],
  ],
  econ: [
    ['ECON201', 'ECON101'], ['ECON202', 'ECON102'], ['ECON211', 'ECON101'],
    ['ECON301', 'ECON211'], ['ECON311', 'ECON201'], ['ECON321', 'ECON201'],
    ['ECON331', 'ECON202'], ['ECON341', 'ECON202'], ['ECON351', 'ECON202'],
    ['ECON361', 'ECON201'], ['ECON371', 'ECON201'], ['ECON381', 'ECON201'],
    ['ECON401', 'ECON301'], ['ECON402', 'ECON301'], ['ECON411', 'ECON301'],
    ['ECON491', 'ECON301'], ['ECON492', 'ECON491'],
  ],
  math: [
    ['MATH102', 'MATH101'], ['MATH201', 'MATH102'], ['MATH202', 'MATH101'],
    ['MATH211', 'MATH102'], ['MATH221', 'MATH102'],
    ['MATH301', 'MATH201'], ['MATH302', 'MATH202'], ['MATH311', 'MATH201'],
    ['MATH321', 'MATH301'], ['MATH331', 'MATH202'], ['MATH341', 'MATH201'],
    ['MATH351', 'MATH221'], ['MATH401', 'MATH301'], ['MATH491', 'MATH301'],
    ['MATH492', 'MATH491'],
  ],
  bio: [
    ['BIO102', 'BIO101'], ['BIO201', 'BIO102'], ['BIO202', 'BIO102'],
    ['BIO211', 'BIO102'], ['BIO221', 'BIO201'],
    ['BIO301', 'BIO201'], ['BIO311', 'BIO201'], ['BIO321', 'BIO202'],
    ['BIO331', 'BIO201'], ['BIO341', 'BIO201'], ['BIO351', 'BIO102'],
    ['BIO401', 'BIO301'], ['BIO411', 'BIO301'], ['BIO491', 'BIO301'],
    ['BIO492', 'BIO491'],
  ],
  chem: [
    ['CHEM102', 'CHEM101'], ['CHEM201', 'CHEM102'], ['CHEM202', 'CHEM201'],
    ['CHEM211', 'CHEM102'], ['CHEM301', 'CHEM202'], ['CHEM302', 'CHEM301'],
    ['CHEM311', 'CHEM202'], ['CHEM321', 'CHEM202'], ['CHEM401', 'CHEM302'],
    ['CHEM491', 'CHEM301'], ['CHEM492', 'CHEM491'],
  ],
  phys: [
    ['PHYS102', 'PHYS101'], ['PHYS201', 'PHYS102'], ['PHYS202', 'PHYS102'],
    ['PHYS211', 'PHYS201'], ['PHYS301', 'PHYS211'], ['PHYS302', 'PHYS301'],
    ['PHYS311', 'PHYS201'], ['PHYS321', 'PHYS302'], ['PHYS331', 'PHYS202'],
    ['PHYS401', 'PHYS302'], ['PHYS491', 'PHYS301'], ['PHYS492', 'PHYS491'],
  ],
  engl: [
    ['ENGL201', 'ENGL102'], ['ENGL202', 'ENGL102'], ['ENGL211', 'ENGL102'],
    ['ENGL301', 'ENGL201'], ['ENGL311', 'ENGL201'], ['ENGL321', 'ENGL201'],
    ['ENGL331', 'ENGL201'], ['ENGL341', 'ENGL201'], ['ENGL401', 'ENGL301'],
    ['ENGL491', 'ENGL401'],
  ],
  hist: [
    ['HIST201', 'HIST102'], ['HIST202', 'HIST201'], ['HIST211', 'HIST102'],
    ['HIST221', 'HIST102'], ['HIST301', 'HIST201'], ['HIST311', 'HIST202'],
    ['HIST321', 'HIST211'], ['HIST331', 'HIST201'], ['HIST401', 'HIST301'],
    ['HIST491', 'HIST401'],
  ],
  psyc: [
    ['PSYC201', 'PSYC101'], ['PSYC211', 'PSYC101'], ['PSYC221', 'PSYC101'],
    ['PSYC231', 'PSYC101'], ['PSYC241', 'PSYC101'], ['PSYC301', 'PSYC211'],
    ['PSYC311', 'PSYC201'], ['PSYC321', 'PSYC201'], ['PSYC331', 'PSYC201'],
    ['PSYC401', 'PSYC301'], ['PSYC491', 'PSYC401'],
  ],
  pols: [
    ['POLS201', 'POLS101'], ['POLS211', 'POLS101'], ['POLS221', 'POLS101'],
    ['POLS231', 'POLS101'], ['POLS301', 'POLS201'], ['POLS311', 'POLS201'],
    ['POLS321', 'POLS221'], ['POLS331', 'POLS211'], ['POLS401', 'POLS301'],
    ['POLS491', 'POLS401'],
  ],
  phil: [
    ['PHIL221', 'PHIL201'], ['PHIL231', 'PHIL101'], ['PHIL301', 'PHIL221'],
    ['PHIL311', 'PHIL201'], ['PHIL321', 'PHIL211'], ['PHIL401', 'PHIL301'],
    ['PHIL491', 'PHIL401'],
  ],
  stat: [
    ['STAT201', 'STAT101'], ['STAT211', 'STAT201'], ['STAT301', 'STAT211'],
    ['STAT311', 'STAT201'], ['STAT321', 'STAT211'], ['STAT401', 'STAT301'],
    ['STAT491', 'STAT401'],
  ],
  soc: [
    ['SOC201', 'SOC101'], ['SOC211', 'SOC101'], ['SOC221', 'SOC101'],
    ['SOC301', 'SOC211'], ['SOC311', 'SOC211'], ['SOC321', 'SOC211'],
    ['SOC401', 'SOC301'], ['SOC491', 'SOC401'],
  ],
  neur: [
    ['NEUR201', 'NEUR101'], ['NEUR211', 'NEUR201'], ['NEUR301', 'NEUR211'],
    ['NEUR311', 'NEUR201'], ['NEUR321', 'NEUR201'], ['NEUR401', 'NEUR301'],
    ['NEUR491', 'NEUR401'],
  ],
  envs: [
    ['ENVS201', 'ENVS101'], ['ENVS211', 'ENVS101'], ['ENVS221', 'ENVS101'],
    ['ENVS301', 'ENVS201'], ['ENVS311', 'ENVS201'], ['ENVS401', 'ENVS301'],
    ['ENVS491', 'ENVS401'],
  ],
  anth: [
    ['ANTH201', 'ANTH101'], ['ANTH211', 'ANTH101'], ['ANTH221', 'ANTH101'],
    ['ANTH301', 'ANTH201'], ['ANTH311', 'ANTH201'], ['ANTH401', 'ANTH301'],
    ['ANTH491', 'ANTH401'],
  ],
  arch: [
    ['ARCH201', 'ARCH111'], ['ARCH202', 'ARCH201'], ['ARCH212', 'ARCH211'],
    ['ARCH222', 'ARCH221'], ['ARCH301', 'ARCH202'], ['ARCH302', 'ARCH301'],
    ['ARCH311', 'ARCH221'], ['ARCH321', 'ARCH202'], ['ARCH401', 'ARCH302'],
    ['ARCH402', 'ARCH401'],
  ],
  engr: [
    ['ENGR202', 'ENGR201'], ['ENGR211', 'ENGR111'], ['ENGR301', 'ENGR201'],
    ['ENGR311', 'ENGR211'], ['ENGR321', 'ENGR221'], ['ENGR401', 'ENGR301'],
    ['ENGR402', 'ENGR401'],
  ],
  gen: [
    ['GEN132', 'GEN131'],
  ],
};

// ─── Major → course disciplines mapping ──────────────────────────────────────
// Maps program name patterns to the disciplines used to build their requirements
// Format: [primaryDiscipline, ...supportingDisciplines]
// We'll pick courses from these disciplines to fill 120 credits
const MAJOR_DISCIPLINES = {
  // CS & Engineering
  'Computer Science': ['cs', 'math', 'engr', 'gen'],
  'Electrical Engineering': ['engr', 'phys', 'math', 'cs', 'gen'],
  'Mechanical Engineering': ['engr', 'phys', 'math', 'gen'],
  'Biomedical Engineering': ['engr', 'bio', 'chem', 'math', 'gen'],
  'Chemical Engineering': ['chem', 'engr', 'math', 'phys', 'gen'],
  'Applied Mathematics': ['math', 'stat', 'cs', 'phys', 'gen'],
  'Mathematics': ['math', 'stat', 'cs', 'gen'],
  'Statistics': ['stat', 'math', 'cs', 'gen'],
  'Data Science': ['cs', 'stat', 'math', 'gen'],

  // Natural Sciences
  'Biology': ['bio', 'chem', 'math', 'gen'],
  'Biochemistry': ['chem', 'bio', 'math', 'gen'],
  'Chemistry': ['chem', 'math', 'phys', 'gen'],
  'Physics': ['phys', 'math', 'gen'],
  'Applied Physics': ['phys', 'math', 'engr', 'gen'],
  'Neuroscience': ['neur', 'bio', 'psyc', 'gen'],
  'Environmental Science': ['envs', 'bio', 'chem', 'gen'],
  'Ecology': ['envs', 'bio', 'gen'],
  'Astronomy': ['phys', 'math', 'gen'],

  // Social Sciences
  'Economics': ['econ', 'math', 'stat', 'gen'],
  'Psychology': ['psyc', 'stat', 'bio', 'gen'],
  'Political Science': ['pols', 'hist', 'econ', 'gen'],
  'Government': ['pols', 'hist', 'econ', 'gen'],
  'Sociology': ['soc', 'psyc', 'stat', 'gen'],
  'Anthropology': ['anth', 'hist', 'bio', 'gen'],

  // Humanities
  'English': ['engl', 'hist', 'phil', 'gen'],
  'History': ['hist', 'pols', 'engl', 'gen'],
  'Philosophy': ['phil', 'hist', 'math', 'gen'],
  'Linguistics': ['phil', 'psyc', 'engl', 'gen'],
  'Classics': ['hist', 'phil', 'engl', 'gen'],
  'Comparative Literature': ['engl', 'hist', 'phil', 'gen'],

  // Arts & Architecture
  'Architecture': ['arch', 'hist', 'engr', 'gen'],
  'Art': ['engl', 'hist', 'phil', 'gen'],
  'Art History': ['hist', 'engl', 'phil', 'gen'],
  'Music': ['engl', 'hist', 'gen'],
  'Theater': ['engl', 'hist', 'gen'],
  'Film': ['engl', 'hist', 'gen'],

  // Interdisciplinary
  'Cognitive Science': ['psyc', 'cs', 'phil', 'neur', 'gen'],
  'Behavioral Economics': ['econ', 'psyc', 'stat', 'gen'],
  'Public Policy': ['pols', 'econ', 'hist', 'gen'],
  'International Studies': ['pols', 'hist', 'econ', 'gen'],
  'African American Studies': ['hist', 'soc', 'pols', 'gen'],
  'American Studies': ['hist', 'pols', 'engl', 'gen'],
  'East Asian Studies': ['hist', 'pols', 'engl', 'gen'],
  'Near Eastern Studies': ['hist', 'pols', 'engl', 'gen'],
  'Latin American Studies': ['hist', 'pols', 'engl', 'gen'],
  'Women\'s Studies': ['soc', 'hist', 'pols', 'gen'],
  'Gender Studies': ['soc', 'hist', 'pols', 'gen'],
  'Religious Studies': ['hist', 'phil', 'engl', 'gen'],
  'Urban Studies': ['soc', 'pols', 'econ', 'gen'],
  'Environmental Studies': ['envs', 'pols', 'econ', 'gen'],
  'Global Affairs': ['pols', 'econ', 'hist', 'gen'],
  'Bioethics': ['phil', 'bio', 'psyc', 'gen'],
  'Biophysics': ['phys', 'bio', 'math', 'gen'],
  'Geoscience': ['envs', 'chem', 'phys', 'gen'],
  'Geology': ['envs', 'chem', 'phys', 'gen'],
  'Astrophysics': ['phys', 'math', 'gen'],
  'Operations Research': ['math', 'stat', 'cs', 'econ', 'gen'],
  'Finance': ['econ', 'math', 'stat', 'gen'],
  'Accounting': ['econ', 'math', 'stat', 'gen'],
  'Business': ['econ', 'math', 'stat', 'gen'],
  'Management': ['econ', 'pols', 'psyc', 'gen'],
  'Marketing': ['econ', 'psyc', 'stat', 'gen'],
  'Information Science': ['cs', 'stat', 'math', 'gen'],
  'Human Biology': ['bio', 'chem', 'psyc', 'gen'],
  'Molecular Biology': ['bio', 'chem', 'math', 'gen'],
  'Evolutionary Biology': ['bio', 'envs', 'math', 'gen'],
  'Microbiology': ['bio', 'chem', 'gen'],
  'Immunology': ['bio', 'chem', 'gen'],
  'Pharmacology': ['bio', 'chem', 'gen'],
  'Public Health': ['bio', 'stat', 'pols', 'gen'],
  'Epidemiology': ['bio', 'stat', 'pols', 'gen'],
  'Geophysics': ['phys', 'envs', 'math', 'gen'],
  'Materials Science': ['phys', 'chem', 'engr', 'gen'],
  'Computational Biology': ['bio', 'cs', 'math', 'gen'],
  'Computational Science': ['cs', 'math', 'phys', 'gen'],
  'Symbolic Systems': ['cs', 'phil', 'psyc', 'gen'],
  'Human-Computer Interaction': ['cs', 'psyc', 'gen'],
  'Robotics': ['cs', 'engr', 'math', 'gen'],
  'Aerospace Engineering': ['engr', 'phys', 'math', 'gen'],
  'Civil Engineering': ['engr', 'phys', 'math', 'gen'],
  'Environmental Engineering': ['engr', 'envs', 'chem', 'gen'],
  'Industrial Engineering': ['engr', 'math', 'stat', 'gen'],
  'Systems Engineering': ['engr', 'cs', 'math', 'gen'],
  'Nuclear Engineering': ['phys', 'engr', 'math', 'gen'],
};

// ─── School prefixes ──────────────────────────────────────────────────────────
const SCHOOL_PREFIXES = {
  'Harvard University': 'HRV',
  'Yale University': 'YLE',
  'Princeton University': 'PRI',
  'Columbia University': 'COL',
  'University of Pennsylvania': 'UPN',
  'Brown University': 'BRN',
  'Dartmouth College': 'DRT',
  'Cornell University': 'CRN',
};

// ─── Seed each school ─────────────────────────────────────────────────────────

for (const [schoolName, schoolId] of Object.entries(schoolMap)) {
  const prefix = SCHOOL_PREFIXES[schoolName];
  console.log(`\nSeeding ${schoolName} (id=${schoolId}, prefix=${prefix})...`);

  // 1. Insert all courses for this school
  const courseIdMap = {}; // codeSuffix -> db id
  let courseCount = 0;

  for (const [discipline, templates] of Object.entries(COURSE_TEMPLATES)) {
    for (const [codeSuffix, name, credits, diff, workload, fall, spring, upper, tags, careers] of templates) {
      const code = `${prefix}${codeSuffix}`;
      const id = await insertIgnore('courses', {
        schoolId,
        code,
        name,
        description: `${name} — a ${discipline.toUpperCase()} course at ${schoolName}.`,
        credits,
        difficultyLevel: diff,
        workloadHours: workload,
        availableFall: fall,
        availableSpring: spring,
        availableSummer: 0,
        isUpperDivision: upper,
        tagsJson: tags,
        careerTracksJson: careers,
      });
      if (id > 0) {
        courseIdMap[codeSuffix] = id;
        courseCount++;
      } else {
        // Already exists, fetch id
        const [rows] = await conn.execute('SELECT id FROM courses WHERE schoolId = ? AND code = ?', [schoolId, code]);
        if (rows.length > 0) courseIdMap[codeSuffix] = rows[0].id;
      }
    }
  }
  console.log(`  Inserted ${courseCount} courses`);

  // 2. Insert prerequisites
  let prereqCount = 0;
  for (const [discipline, chains] of Object.entries(PREREQ_CHAINS)) {
    for (const [courseCode, prereqCode] of chains) {
      const courseId = courseIdMap[courseCode];
      const prereqId = courseIdMap[prereqCode];
      if (courseId && prereqId) {
        await insertIgnore('prerequisites', { courseId, prerequisiteCourseId: prereqId, type: 'required' });
        prereqCount++;
      }
    }
  }
  console.log(`  Inserted ${prereqCount} prerequisites`);

  // 3. Get all programs for this school
  const [programs] = await conn.execute('SELECT id, name, type, totalCreditsRequired FROM programs WHERE schoolId = ?', [schoolId]);
  console.log(`  Found ${programs.length} programs`);

  // 4. For each program, create requirement categories and assign courses
  let programCount = 0;
  for (const program of programs) {
    const disciplines = getDisciplinesForProgram(program.name, program.type);
    await buildProgramRequirements(program, disciplines, courseIdMap, schoolId);
    programCount++;
  }
  console.log(`  Built requirements for ${programCount} programs`);
}

// ─── Helper: get disciplines for a program ───────────────────────────────────

function getDisciplinesForProgram(programName, programType) {
  // Try exact match first
  if (MAJOR_DISCIPLINES[programName]) return MAJOR_DISCIPLINES[programName];
  
  // Try partial match
  for (const [key, discs] of Object.entries(MAJOR_DISCIPLINES)) {
    if (programName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(programName.toLowerCase())) {
      return discs;
    }
  }
  
  // For minors, use a smaller subset
  if (programType === 'minor') {
    // Try to infer from name
    const name = programName.toLowerCase();
    if (name.includes('comput') || name.includes('software')) return ['cs', 'math', 'gen'];
    if (name.includes('econom') || name.includes('financ')) return ['econ', 'math', 'gen'];
    if (name.includes('math') || name.includes('statist')) return ['math', 'stat', 'gen'];
    if (name.includes('bio') || name.includes('life science')) return ['bio', 'chem', 'gen'];
    if (name.includes('chem')) return ['chem', 'math', 'gen'];
    if (name.includes('phys')) return ['phys', 'math', 'gen'];
    if (name.includes('english') || name.includes('writing') || name.includes('liter')) return ['engl', 'hist', 'gen'];
    if (name.includes('hist')) return ['hist', 'pols', 'gen'];
    if (name.includes('psych')) return ['psyc', 'stat', 'gen'];
    if (name.includes('politi') || name.includes('govern')) return ['pols', 'hist', 'gen'];
    if (name.includes('philos')) return ['phil', 'hist', 'gen'];
    if (name.includes('sociol')) return ['soc', 'psyc', 'gen'];
    if (name.includes('anthro')) return ['anth', 'hist', 'gen'];
    if (name.includes('neuro')) return ['neur', 'bio', 'gen'];
    if (name.includes('environ')) return ['envs', 'bio', 'gen'];
    if (name.includes('archit')) return ['arch', 'hist', 'gen'];
    if (name.includes('engineer')) return ['engr', 'math', 'gen'];
    if (name.includes('art')) return ['engl', 'hist', 'gen'];
    if (name.includes('music') || name.includes('theater') || name.includes('film')) return ['engl', 'hist', 'gen'];
    if (name.includes('asian') || name.includes('african') || name.includes('latin') || name.includes('american studies')) return ['hist', 'pols', 'gen'];
    if (name.includes('gender') || name.includes('women')) return ['soc', 'hist', 'gen'];
    if (name.includes('religion')) return ['hist', 'phil', 'gen'];
    if (name.includes('language') || name.includes('linguis')) return ['phil', 'engl', 'gen'];
    if (name.includes('data')) return ['cs', 'stat', 'math', 'gen'];
    if (name.includes('public') || name.includes('policy')) return ['pols', 'econ', 'gen'];
    if (name.includes('cognitive')) return ['psyc', 'cs', 'phil', 'gen'];
    if (name.includes('global') || name.includes('international')) return ['pols', 'hist', 'econ', 'gen'];
    if (name.includes('urban')) return ['soc', 'pols', 'econ', 'gen'];
  }
  
  // Default fallback: general education + history + philosophy
  return ['hist', 'engl', 'phil', 'gen'];
}

// ─── Helper: build program requirements ──────────────────────────────────────

async function buildProgramRequirements(program, disciplines, courseIdMap, schoolId) {
  const isMajor = program.type === 'major';
  const totalCredits = program.totalCreditsRequired || (isMajor ? 120 : 18);
  
  // For majors: 120 credits = ~30 courses at 4 credits each
  // Category breakdown:
  //   Core requirements: 48 credits (12 courses from primary discipline)
  //   Supporting requirements: 32 credits (8 courses from secondary disciplines)
  //   Electives: 24 credits (6 courses from any discipline)
  //   General Education: 16 credits (4 gen ed courses)
  
  // For minors: 18-20 credits = ~5 courses from primary discipline
  
  const [primaryDisc, ...supportingDiscs] = disciplines;
  const primaryCourses = COURSE_TEMPLATES[primaryDisc] || [];
  const genCourses = COURSE_TEMPLATES['gen'] || [];
  
  if (isMajor) {
    // Category 1: Core Requirements (primary discipline, intro + intermediate)
    const coreCourses = primaryCourses
      .filter(c => !c[0].endsWith('491') && !c[0].endsWith('492'))
      .slice(0, 12);
    const coreCredits = coreCourses.reduce((s, c) => s + c[2], 0);
    
    const cat1Id = await insert('requirement_categories', {
      programId: program.id,
      name: 'Core Requirements',
      type: 'core',
      creditsRequired: coreCredits,
      coursesRequired: coreCourses.length,
      description: `Required core courses for ${program.name}`,
      sortOrder: 1,
    });
    for (const course of coreCourses) {
      const cid = courseIdMap[course[0]];
      if (cid) await insertIgnore('degree_requirements', { categoryId: cat1Id, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
    }
    
    // Category 2: Advanced Courses (upper division primary)
    const advCourses = primaryCourses
      .filter(c => c[7] === 1 && !c[0].endsWith('491') && !c[0].endsWith('492'))
      .slice(0, 6);
    const advCredits = advCourses.reduce((s, c) => s + c[2], 0);
    
    if (advCourses.length > 0) {
      const cat2Id = await insert('requirement_categories', {
        programId: program.id,
        name: 'Advanced Courses',
        type: 'advanced',
        creditsRequired: advCredits,
        coursesRequired: advCourses.length,
        description: `Advanced upper-division courses for ${program.name}`,
        sortOrder: 2,
      });
      for (const course of advCourses) {
        const cid = courseIdMap[course[0]];
        if (cid) await insertIgnore('degree_requirements', { categoryId: cat2Id, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
      }
    }
    
    // Category 3: Supporting Courses (from secondary disciplines)
    const suppCourses = [];
    for (const disc of supportingDiscs.slice(0, 2)) {
      const discCourses = (COURSE_TEMPLATES[disc] || [])
        .filter(c => !c[7]) // intro/intermediate only
        .slice(0, 3);
      suppCourses.push(...discCourses);
    }
    const suppCredits = suppCourses.reduce((s, c) => s + c[2], 0);
    
    if (suppCourses.length > 0) {
      const cat3Id = await insert('requirement_categories', {
        programId: program.id,
        name: 'Supporting Courses',
        type: 'supporting',
        creditsRequired: suppCredits,
        coursesRequired: suppCourses.length,
        description: `Supporting courses from related disciplines`,
        sortOrder: 3,
      });
      for (const course of suppCourses) {
        const cid = courseIdMap[course[0]];
        if (cid) await insertIgnore('degree_requirements', { categoryId: cat3Id, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
      }
    }
    
    // Category 4: Thesis/Capstone
    const thesisCourses = primaryCourses.filter(c => c[0].endsWith('491') || c[0].endsWith('492'));
    if (thesisCourses.length > 0) {
      const thesisCredits = thesisCourses.reduce((s, c) => s + c[2], 0);
      const cat4Id = await insert('requirement_categories', {
        programId: program.id,
        name: 'Thesis / Capstone',
        type: 'capstone',
        creditsRequired: thesisCredits,
        coursesRequired: thesisCourses.length,
        description: 'Senior thesis or capstone project',
        sortOrder: 4,
      });
      for (const course of thesisCourses) {
        const cid = courseIdMap[course[0]];
        if (cid) await insertIgnore('degree_requirements', { categoryId: cat4Id, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
      }
    }
    
    // Category 5: General Education
    const genEd = genCourses.slice(0, 4);
    const genCredits = genEd.reduce((s, c) => s + c[2], 0);
    const cat5Id = await insert('requirement_categories', {
      programId: program.id,
      name: 'General Education',
      type: 'general',
      creditsRequired: genCredits,
      coursesRequired: genEd.length,
      description: 'General education requirements',
      sortOrder: 5,
    });
    for (const course of genEd) {
      const cid = courseIdMap[course[0]];
      if (cid) await insertIgnore('degree_requirements', { categoryId: cat5Id, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
    }
    
    // Category 6: Electives (fill remaining credits)
    const electives = [];
    for (const disc of supportingDiscs) {
      const discCourses = (COURSE_TEMPLATES[disc] || [])
        .filter(c => !suppCourses.find(s => s[0] === c[0]) && !coreCourses.find(s => s[0] === c[0]))
        .slice(0, 2);
      electives.push(...discCourses);
    }
    const electiveSlice = electives.slice(0, 6);
    const electiveCredits = electiveSlice.reduce((s, c) => s + c[2], 0);
    
    if (electiveSlice.length > 0) {
      const cat6Id = await insert('requirement_categories', {
        programId: program.id,
        name: 'Electives',
        type: 'elective',
        creditsRequired: electiveCredits,
        coursesRequired: electiveSlice.length,
        description: 'Elective courses to complete degree requirements',
        sortOrder: 6,
      });
      for (const course of electiveSlice) {
        const cid = courseIdMap[course[0]];
        if (cid) await insertIgnore('degree_requirements', { categoryId: cat6Id, courseId: cid, isRequired: 0, alternativeCourseIdsJson: '[]', notes: 'Choose from approved electives' });
      }
    }
    
  } else {
    // Minor: 18-20 credits, 1 category with 5-6 intro courses
    const minorCourses = primaryCourses
      .filter(c => !c[7]) // intro/intermediate
      .slice(0, 5);
    const minorCredits = minorCourses.reduce((s, c) => s + c[2], 0);
    
    const catId = await insert('requirement_categories', {
      programId: program.id,
      name: 'Minor Requirements',
      type: 'core',
      creditsRequired: minorCredits,
      coursesRequired: minorCourses.length,
      description: `Required courses for ${program.name} minor`,
      sortOrder: 1,
    });
    for (const course of minorCourses) {
      const cid = courseIdMap[course[0]];
      if (cid) await insertIgnore('degree_requirements', { categoryId: catId, courseId: cid, isRequired: 1, alternativeCourseIdsJson: '[]', notes: null });
    }
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────

await conn.end();
console.log('\n✅ Ivy League seed fix complete!');

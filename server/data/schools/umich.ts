export const UMICH_SCHOOL_ID = 2;
export const UMICH_PROGRAM_SOURCE =
  "Catalog entry from official University of Michigan undergraduate admissions/LSA program lists. Requirement-level course planning is not yet ingested.";

export const makeUmichSchool = (createdAt: () => Date) => ({
  id: UMICH_SCHOOL_ID,
  name: "University of Michigan",
  shortName: "U-M",
  location: "Ann Arbor, MI",
  semesterSystem: "semester",
  maxCreditsPerSemester: 18,
  minCreditsPerSemester: 12,
  createdAt: createdAt(),
});

export const umichMajors = [
  "Actuarial Mathematics",
  "Aerospace Engineering",
  "Afroamerican and African Studies",
  "American Culture",
  "Anthropology",
  "Applied Exercise Science",
  "Archaeology",
  "Archaeology of the Ancient Mediterranean",
  "Architecture",
  "Art and Design",
  "Arts and Ideas in the Humanities",
  "Asian Studies",
  "Astronomy and Astrophysics",
  "Biochemistry",
  "Biological Physics",
  "Biology",
  "Biology, Health, and Society",
  "Biomedical Engineering",
  "Biomolecular Science",
  "Biophysics",
  "Biopsychology, Cognition, and Neuroscience",
  "Business",
  "Cellular and Molecular Biomedical Science",
  "Chemical Engineering",
  "Chemistry",
  "Chinese Studies",
  "Civil Engineering",
  "Classical Civilization",
  "Classical Languages and Literatures",
  "Climate and Meteorology",
  "Cognitive Science",
  "Communication and Media",
  "Community and Global Public Health",
  "Comparative Culture and Identity",
  "Comparative Literature, Arts, and Media",
  "Composition",
  "Computer Engineering",
  "Computer Science (BS)",
  "Computer Science (BSE)",
  "Creative Writing and Literature",
  "Culture and Media",
  "Dance",
  "Data Science",
  "Data Science (BS)",
  "Dental Hygiene",
  "Drama",
  "Earth and Environmental Sciences",
  "Ecology, Evolution, and Biodiversity",
  "Economics",
  "Electrical Engineering",
  "Elementary Teacher Education",
  "Engineering Physics",
  "English",
  "Environment",
  "Environment and Conservation",
  "Environmental Engineering",
  "Ethnic Studies",
  "Film, Television, and Media",
  "French and Francophone Studies",
  "Gender and Health",
  "General Studies",
  "German",
  "Global Environment and Health",
  "Greek (Ancient) Language and Literature",
  "Greek (Modern) Language and Culture",
  "History",
  "History of Art",
  "Honors Mathematics",
  "Human Origins, Biology, and Behavior",
  "Industrial and Operations Engineering",
  "Information Analysis and Design",
  "Integrated Business and Engineering at Michigan",
  "Interarts Performance",
  "Interdisciplinary Astronomy",
  "Interdisciplinary Chemical Sciences",
  "Interdisciplinary Physics",
  "International Security, Norms, and Cooperation",
  "International Studies",
  "Italian",
  "Japanese Studies",
  "Jazz & Contemporary Improvisation",
  "Judaic Studies",
  "Korean Studies",
  "Latin American and Caribbean Studies",
  "Latin Language and Literature",
  "Latina/Latino Studies",
  "Law, Justice, and Social Change",
  "Learning, Equity, and Problem Solving for the Public Good (LEAPS)",
  "Linguistics",
  "Materials Science and Engineering",
  "Mathematical Sciences",
  "Mathematics",
  "Mathematics of Finance and Risk Management",
  "Mechanical Engineering",
  "Medical Anthropology",
  "Microbiology",
  "Middle East Studies",
  "Middle Eastern and North African Studies",
  "Molecular, Cellular, and Developmental Biology",
  "Movement Science",
  "Music",
  "Music Education",
  "Music Theory",
  "Musical Theatre",
  "Musicology",
  "Naval Architecture and Marine Engineering",
  "Neuroscience",
  "Nuclear Engineering and Radiological Sciences",
  "Nursing",
  "Organ",
  "Organizational Studies",
  "Performing Arts Technology",
  "Pharmaceutical Sciences",
  "Philosophy",
  "Philosophy, Politics, and Economics",
  "Physics",
  "Piano",
  "Plant Biology",
  "Polish",
  "Political Economy and Development",
  "Political Science",
  "Politics, Law, and Economy",
  "Power, Identity, and Inequality",
  "Psychology",
  "Public Health Sciences",
  "Public Policy",
  "Pure Mathematics",
  "Robotics",
  "Romance Languages and Literatures",
  "Russian",
  "Russian, East European, and Eurasian Studies",
  "Screenwriting",
  "Secondary Mathematics Teaching Certificate",
  "Secondary Teacher Education",
  "Social Theory and Practice",
  "Sociology",
  "Sociology and Social Work",
  "Sociology of Health and Medicine",
  "South Asian Studies",
  "Southeast Asian Studies",
  "Space Sciences and Engineering",
  "Spanish",
  "Sport Management",
  "Statistics",
  "Strings",
  "Structural Biology",
  "Theatre & Drama",
  "Translation",
  "Urban Technology",
  "User Experience Design",
  "Voice & Opera",
  "Winds & Percussion",
  "Women's and Gender Studies",
] as const;

export const umichMinors = [
  "Afroamerican and African Studies",
  "American Culture",
  "Anthropology",
  "Arab and Muslim American Studies",
  "Arabic Studies",
  "Archaeology of the Ancient Mediterranean",
  "Architecture",
  "Art & Design",
  "Artificial Intelligence",
  "Asian Languages and Cultures",
  "Asian Studies",
  "Asian/Pacific Islander American Studies",
  "Astronomy and Astrophysics",
  "Biochemistry",
  "Biological Anthropology",
  "Biology",
  "Biophysics",
  "Bosnian/Croatian/Serbian, Literature and Culture",
  "Business",
  "Chemistry",
  "Civil Engineering",
  "Classical Civilization",
  "Classical Languages",
  "Climate and Space Sciences and Engineering",
  "Community Action and Social Change",
  "Complex Systems",
  "Computer Science",
  "Computing for Expression",
  "Computing for Scientific Discovery",
  "Creative Writing",
  "Crime and Justice",
  "Cultures and Literatures of Eastern Europe",
  "Czech Language, Literature, and Culture",
  "Dance",
  "Data Science",
  "Digital Studies",
  "Disability Studies",
  "Drama",
  "Dutch Language and Culture",
  "Earth Sciences",
  "East European and Eurasian Studies",
  "Ecology and Evolutionary Biology",
  "Economics",
  "Education for Empowerment",
  "Electrical Engineering",
  "Energy Science and Policy",
  "English",
  "Entrepreneurship",
  "Environment",
  "Environmental Justice",
  "Epistemology and Philosophy of Science",
  "Food and the Environment",
  "French and Francophone Studies",
  "Gender and Health",
  "Gender, Race, and Nation",
  "Geology",
  "Geospatial Science",
  "German Studies",
  "Global History",
  "Global Media Studies",
  "Global Theatre and Ethnic Studies",
  "Greek (Modern) Language and Culture",
  "History",
  "History of Art",
  "History of Law and Policy",
  "History of Medicine and Health",
  "History of Philosophy",
  "Human Anatomy and Physiology",
  "Human-Centered Artificial Intelligence",
  "Interdisciplinary Astronomy",
  "Intergroup Relations Education",
  "International Studies",
  "Islamic Studies",
  "Italian",
  "Judaic Studies",
  "Latin American and Caribbean Studies",
  "Latina/o Studies",
  "Law, Justice, and Social Change",
  "Lesbian Gay Bisexual Transgender Queer Sexuality Studies",
  "Linguistics",
  "Mathematics",
  "Medical Anthropology",
  "Medieval and Early Modern Studies",
  "Middle East Studies",
  "Mind and Meaning",
  "Modern Middle Eastern and North African Studies",
  "Moral and Political Philosophy",
  "Multidisciplinary Design",
  "Museum Studies",
  "Music",
  "Native American Studies",
  "Nuclear Engineering & Radiological Sciences",
  "Oceanography",
  "Paleontology",
  "Performing Arts Management and Entrepreneurship",
  "Performing Arts Technology",
  "Pharmacology",
  "Philosophy",
  "Physics",
  "Playwriting",
  "Polish Language, Literature and Culture",
  "Political Science",
  "Portuguese",
  "Public Policy",
  "Quantitative Methods in the Social Sciences",
  "Real Estate",
  "Religion",
  "Russian Language, Literature, and Culture",
  "Russian Studies",
  "Scandinavian Studies",
  "Science, Technology, and Society (STS)",
  "Social Class and Inequality Studies",
  "Social Media Analysis and Design",
  "Sociology of Health and Medicine",
  "Spanish Language, Literature, and Culture",
  "Statistics",
  "Sustainability",
  "Theatre Design and Production",
  "Translation Studies",
  "Ukrainian Language, Literature, and Culture",
  "Urban Studies",
  "User Experience Design",
  "Water and the Environment",
  "Writing",
  "Yiddish Studies",
] as const;

export const makeUmichPrograms = (createdAt: () => Date) => [
  ...umichMajors.map((name, index) => ({
    id: 2000 + index,
    schoolId: UMICH_SCHOOL_ID,
    name,
    shortName: name,
    type: "major" as const,
    totalCreditsRequired: 120,
    description: UMICH_PROGRAM_SOURCE,
    createdAt: createdAt(),
  })),
  ...umichMinors.map((name, index) => ({
    id: 3000 + index,
    schoolId: UMICH_SCHOOL_ID,
    name,
    shortName: name,
    type: "minor" as const,
    totalCreditsRequired: 15,
    description: UMICH_PROGRAM_SOURCE,
    createdAt: createdAt(),
  })),
];

type UmichProgram = ReturnType<typeof makeUmichPrograms>[number];

const subjectOverrides: Record<string, string> = {
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
  Film: "FTVM",
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

const normalizeProgramName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .trim();

const toSubjectCode = (name: string) => {
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
};

const toTags = (name: string, type: UmichProgram["type"]) =>
  JSON.stringify([
    "umich",
    type,
    ...normalizeProgramName(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .slice(0, 4),
  ]);

const toCareerTracks = (name: string) => {
  const lower = name.toLowerCase();
  const tracks = new Set<string>();

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
};

const makeCourse = (
  program: UmichProgram,
  index: number,
  level: 100 | 200 | 300 | 400,
  title: string,
  credits: number,
  createdAt: () => Date
) => {
  const subject = toSubjectCode(program.name);
  const courseNumber = level + index;

  return {
    id: program.id * 100 + index,
    schoolId: UMICH_SCHOOL_ID,
    code: `${subject} ${courseNumber}`,
    name: `${normalizeProgramName(program.name)} ${title}`,
    description: `${title} for the University of Michigan ${program.name} ${program.type}. Advisor verification is recommended before final registration.`,
    credits,
    difficultyLevel: Math.min(5, Math.max(2, Math.floor(level / 100))),
    workloadHours: credits * (level >= 400 ? 4 : level >= 300 ? 3.5 : 3),
    availableFall: true,
    availableSpring: true,
    availableSummer: level < 400,
    isUpperDivision: level >= 300,
    tagsJson: toTags(program.name, program.type),
    careerTracksJson: toCareerTracks(program.name),
    createdAt: createdAt(),
  };
};

const isComputerScienceProgram = (program: UmichProgram) =>
  normalizeProgramName(program.name) === "Computer Science";

const coeMajorNames = new Set([
  "Aerospace Engineering",
  "Biomedical Engineering",
  "Chemical Engineering",
  "Civil Engineering",
  "Climate and Meteorology",
  "Computer Engineering",
  "Computer Science",
  "Data Science",
  "Electrical Engineering",
  "Engineering Physics",
  "Environmental Engineering",
  "Industrial and Operations Engineering",
  "Integrated Business and Engineering at Michigan",
  "Materials Science and Engineering",
  "Mechanical Engineering",
  "Naval Architecture and Marine Engineering",
  "Nuclear Engineering and Radiological Sciences",
  "Robotics",
  "Space Sciences and Engineering",
]);

const isCollegeOfEngineeringMajor = (program: UmichProgram) =>
  program.type === "major" && coeMajorNames.has(normalizeProgramName(program.name));

const umichCoECoreCoursePlan = [
  [1, "MATH 115", "Calculus I", 4, 100, 3],
  [2, "ENGR 100", "Introduction to Engineering", 4, 100, 2],
  [3, "CHEM 130", "General Chemistry: Macroscopic Investigations and Reaction Principles", 3, 100, 3],
  [4, "CHEM 125", "General Chemistry Laboratory I", 2, 100, 2],
  [5, "MATH 116", "Calculus II", 4, 100, 3],
  [6, "ENGR 101", "Introduction to Computers and Programming", 4, 100, 2],
  [7, "PHYSICS 140", "General Physics I", 4, 100, 3],
  [8, "PHYSICS 141", "Elementary Laboratory I", 1, 100, 2],
  [9, "MATH 215", "Calculus III", 4, 200, 3],
  [10, "PHYSICS 240", "General Physics II", 4, 200, 3],
  [11, "PHYSICS 241", "Elementary Laboratory II", 1, 200, 2],
  [12, "MATH 216", "Introduction to Differential Equations", 4, 200, 3],
] as const;

const coeMajorCourseTemplates = [
  [13, 200, "Fundamentals", 4, 3],
  [14, 200, "Laboratory and Modeling", 3, 3],
  [15, 300, "Systems Analysis", 4, 4],
  [16, 300, "Design and Experimentation", 4, 4],
  [17, 300, "Technical Elective I", 4, 4],
  [18, 400, "Technical Elective II", 4, 4],
  [19, 400, "Professional Practice", 3, 3],
  [20, 400, "Capstone Design", 4, 5],
] as const;

const coeCorePrerequisitePairs = [
  [5, 1],
  [9, 5],
  [10, 7],
  [12, 5],
] as const;

const coeMajorPrerequisitePairs = [
  [13, 5],
  [14, 13],
  [15, 9],
  [15, 13],
  [16, 14],
  [17, 15],
  [18, 17],
  [19, 16],
  [20, 18],
  [20, 19],
] as const;

const makeUmichCoECourse = (
  program: UmichProgram,
  [index, code, name, credits, level, difficultyLevel]: (typeof umichCoECoreCoursePlan)[number],
  createdAt: () => Date
) => ({
  id: program.id * 100 + index,
  schoolId: UMICH_SCHOOL_ID,
  code,
  name,
  description: `University of Michigan College of Engineering core course used across CoE major plans. Confirm placement, AP/IB/transfer credit, and substitutions with Engineering Advising.`,
  credits,
  difficultyLevel,
  workloadHours: credits * (difficultyLevel >= 4 ? 3.5 : 3),
  availableFall: true,
  availableSpring: true,
  availableSummer: level < 300,
  isUpperDivision: level >= 300,
  tagsJson: JSON.stringify(["umich", "coe-core", "engineering"]),
  careerTracksJson: JSON.stringify(["engineering", "grad_school"]),
  createdAt: createdAt(),
});

const makeUmichCoEMajorCourse = (
  program: UmichProgram,
  [index, level, title, credits, difficultyLevel]: (typeof coeMajorCourseTemplates)[number],
  createdAt: () => Date
) => {
  const subject = toSubjectCode(program.name);
  const courseNumber = level + (index - 12);

  return {
    id: program.id * 100 + index,
    schoolId: UMICH_SCHOOL_ID,
    code: `${subject} ${courseNumber}`,
    name: `${normalizeProgramName(program.name)} ${title}`,
    description: `Representative University of Michigan ${program.name} major requirement layered after the shared College of Engineering core. Verify exact catalog-year requirements with the department.`,
    credits,
    difficultyLevel,
    workloadHours: credits * (difficultyLevel >= 4 ? 3.5 : 3),
    availableFall: true,
    availableSpring: true,
    availableSummer: level < 400,
    isUpperDivision: level >= 300,
    tagsJson: JSON.stringify(["umich", "coe-major", ...normalizeProgramName(program.name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4)]),
    careerTracksJson: toCareerTracks(program.name),
    createdAt: createdAt(),
  };
};

const umichCsCoursePlan = [
  [1, "MATH 115", "Calculus I", 4, 100, 3],
  [2, "ENGR 101", "Introduction to Computers and Programming", 4, 100, 2],
  [3, "CHEM 130", "General Chemistry: Macroscopic Investigations and Reaction Principles", 3, 100, 3],
  [4, "CHEM 125", "General Chemistry Laboratory I", 2, 100, 2],
  [5, "MATH 116", "Calculus II", 4, 100, 3],
  [6, "ENGR 100", "Introduction to Engineering", 4, 100, 2],
  [7, "PHYSICS 140", "General Physics I", 4, 100, 3],
  [8, "PHYSICS 141", "Elementary Laboratory I", 1, 100, 2],
  [9, "PHYSICS 240", "General Physics II", 4, 200, 3],
  [10, "PHYSICS 241", "Elementary Laboratory II", 1, 200, 2],
  [11, "EECS 203", "Discrete Mathematics", 4, 200, 3],
  [12, "EECS 280", "Programming and Introductory Data Structures", 4, 200, 3],
  [13, "MATH 214", "Applied Linear Algebra", 4, 200, 3],
  [14, "EECS 281", "Data Structures and Algorithms", 4, 200, 4],
  [15, "MATH 215", "Calculus III", 4, 200, 3],
  [16, "EECS 370", "Introduction to Computer Organization", 4, 300, 4],
  [17, "STATS 250", "Introduction to Statistics and Data Analysis", 4, 200, 3],
  [18, "EECS 376", "Foundations of Computer Science", 4, 300, 4],
  [19, "TCHNCLCM 300", "Technical Communication for Electrical Engineering and Computer Science", 1, 300, 2],
  [20, "EECS 496", "Major Design Experience Professionalism", 2, 400, 3],
  [21, "TCHNCLCM 497", "Advanced Technical Communication for Electrical Engineering and Computer Science", 2, 400, 2],
  [22, "EECS 485", "Web Systems", 4, 400, 4],
  [23, "EECS 482", "Introduction to Operating Systems", 4, 400, 5],
  [24, "EECS 445", "Introduction to Machine Learning", 4, 400, 4],
] as const;

const umichCsPrerequisitePairs = [
  [5, 1],
  [9, 7],
  [11, 1],
  [12, 2],
  [13, 5],
  [14, 11],
  [14, 12],
  [15, 5],
  [16, 12],
  [18, 11],
  [18, 12],
  [19, 12],
  [20, 14],
  [21, 19],
  [22, 14],
  [23, 14],
  [24, 14],
] as const;

const makeUmichComputerScienceCourse = (
  program: UmichProgram,
  [index, code, name, credits, level, difficultyLevel]: (typeof umichCsCoursePlan)[number],
  createdAt: () => Date
) => ({
  id: program.id * 100 + index,
  schoolId: UMICH_SCHOOL_ID,
  code,
  name,
  description: `University of Michigan Computer Science planning course. Verify section availability and requirement applicability in the official U-M catalog or with a CSE advisor.`,
  credits,
  difficultyLevel,
  workloadHours: credits * (difficultyLevel >= 4 ? 3.5 : 3),
  availableFall: true,
  availableSpring: true,
  availableSummer: level < 300,
  isUpperDivision: level >= 300,
  tagsJson: JSON.stringify(["umich", "computer-science", "official-aligned"]),
  careerTracksJson: JSON.stringify(["software_engineering", "data_science", "engineering"]),
  createdAt: createdAt(),
});

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
] as const;

const minorCoursePlan = [
  [1, 100, "Foundations", 3],
  [2, 200, "Methods", 3],
  [3, 300, "Applied Topics", 3],
  [4, 300, "Elective Seminar", 3],
  [5, 400, "Integrative Project", 3],
] as const;

export const makeUmichCourses = (createdAt: () => Date): any[] =>
  makeUmichPrograms(createdAt).flatMap(program => {
    if (isComputerScienceProgram(program)) {
      return umichCsCoursePlan.map(course =>
        makeUmichComputerScienceCourse(program, course, createdAt)
      );
    }

    if (isCollegeOfEngineeringMajor(program)) {
      return [
        ...umichCoECoreCoursePlan.map(course =>
          makeUmichCoECourse(program, course, createdAt)
        ),
        ...coeMajorCourseTemplates.map(course =>
          makeUmichCoEMajorCourse(program, course, createdAt)
        ),
      ];
    }

    const plan = program.type === "major" ? majorCoursePlan : minorCoursePlan;
    return plan.map(([index, level, title, credits]) =>
      makeCourse(program, index, level, title, credits, createdAt)
    );
  });

export const makeUmichPrerequisites = (): any[] =>
  makeUmichPrograms(() => new Date()).flatMap(program => {
    if (isComputerScienceProgram(program)) {
      return umichCsPrerequisitePairs.map(([courseIndex, prerequisiteIndex], index) => ({
        id: program.id * 100 + index + 1,
        courseId: program.id * 100 + courseIndex,
        prerequisiteCourseId: program.id * 100 + prerequisiteIndex,
        type: "required" as const,
        minimumGrade: "C",
      }));
    }

    if (isCollegeOfEngineeringMajor(program)) {
      return [...coeCorePrerequisitePairs, ...coeMajorPrerequisitePairs].map(
        ([courseIndex, prerequisiteIndex], index) => ({
          id: program.id * 100 + index + 1,
          courseId: program.id * 100 + courseIndex,
          prerequisiteCourseId: program.id * 100 + prerequisiteIndex,
          type: "required" as const,
          minimumGrade: "C",
        })
      );
    }

    const courseIds =
      program.type === "major"
        ? majorCoursePlan.map(([index]) => program.id * 100 + index)
        : minorCoursePlan.map(([index]) => program.id * 100 + index);

    return courseIds.slice(1).map((courseId, index) => ({
      id: program.id * 100 + index + 1,
      courseId,
      prerequisiteCourseId: courseIds[index],
      type: "required" as const,
      minimumGrade: "D",
    }));
  });

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
] as const;

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
] as const;

const umichCsCategoryPlan = [
  [
    "First-Year Engineering Core",
    "core",
    22,
    8,
    "Calculus, engineering, chemistry, and physics foundation from the U-M Engineering sample schedule.",
    [1, 2, 3, 4, 5, 6, 7, 8],
  ],
  [
    "Sophomore CS Foundation",
    "core",
    21,
    6,
    "Discrete math, programming, data structures, physics, and applied linear algebra.",
    [9, 10, 11, 12, 13, 14],
  ],
  [
    "Upper-Level CS Core",
    "core",
    13,
    4,
    "Computer organization, foundations, statistics, and technical communication.",
    [16, 17, 18, 19],
  ],
  [
    "Advanced Design and Electives",
    "capstone",
    20,
    6,
    "Major design/professionalism plus representative upper-level CS electives.",
    [20, 21, 22, 23, 24, 15],
  ],
] as const;

const umichCoECategoryPlan = [
  [
    "College of Engineering First-Year Core",
    "core",
    22,
    8,
    "Shared U-M Engineering first-year calculus, engineering, chemistry, and physics sequence.",
    [1, 2, 3, 4, 5, 6, 7, 8],
  ],
  [
    "College of Engineering Math and Physics Core",
    "core",
    13,
    4,
    "Calculus III, differential equations, and second-term physics sequence.",
    [9, 10, 11, 12],
  ],
  [
    "Major Technical Foundation",
    "core",
    15,
    4,
    "Department-specific introductory technical requirements after the CoE core.",
    [13, 14, 15, 16],
  ],
  [
    "Advanced Major Requirements",
    "capstone",
    15,
    4,
    "Upper-level technical electives, professional practice, and capstone design.",
    [17, 18, 19, 20],
  ],
] as const;

export const makeUmichRequirementCategories = (): any[] =>
  makeUmichPrograms(() => new Date()).flatMap(program => {
    if (isComputerScienceProgram(program)) {
      return umichCsCategoryPlan.map(
        ([name, type, creditsRequired, coursesRequired, description], index) => ({
          id: program.id * 10 + index + 1,
          programId: program.id,
          name,
          type,
          creditsRequired,
          coursesRequired,
          description,
          sortOrder: index + 1,
        })
      ) as any[];
    }

    if (isCollegeOfEngineeringMajor(program)) {
      return umichCoECategoryPlan.map(
        ([name, type, creditsRequired, coursesRequired, description], index) => ({
          id: program.id * 10 + index + 1,
          programId: program.id,
          name,
          type,
          creditsRequired,
          coursesRequired,
          description: `${description} Exact requirements vary by department and catalog year; advisor verification is recommended.`,
          sortOrder: index + 1,
        })
      ) as any[];
    }

    const plan =
      program.type === "major" ? majorCategoryPlan : minorCategoryPlan;
    return plan.map(
      ([name, type, creditsRequired, coursesRequired, description], index) => ({
        id: program.id * 10 + index + 1,
        programId: program.id,
        name,
        type,
        creditsRequired,
        coursesRequired,
        description: `${description} Generated catalog coverage for University of Michigan ${program.name}.`,
        sortOrder: index + 1,
      })
    ) as any[];
  });

export const makeUmichDegreeRequirements = (): any[] =>
  makeUmichPrograms(() => new Date()).flatMap(program => {
    if (isComputerScienceProgram(program)) {
      let requirementOffset = 0;
      return umichCsCategoryPlan.flatMap(([, , , , , courseIndexes], categoryIndex) => {
        const categoryId = program.id * 10 + categoryIndex + 1;
        return courseIndexes.map(courseIndex => {
          requirementOffset += 1;
          return {
            id: program.id * 100 + requirementOffset,
            categoryId,
            courseId: program.id * 100 + courseIndex,
            isRequired: true,
            alternativeCourseIdsJson: "[]",
            notes:
              "U-M CS-aligned planning requirement. Confirm exact catalog-year applicability and substitutions with official advising.",
          };
        });
      });
    }

    if (isCollegeOfEngineeringMajor(program)) {
      let requirementOffset = 0;
      return umichCoECategoryPlan.flatMap(([, , , , , courseIndexes], categoryIndex) => {
        const categoryId = program.id * 10 + categoryIndex + 1;
        return courseIndexes.map(courseIndex => {
          requirementOffset += 1;
          return {
            id: program.id * 100 + requirementOffset,
            categoryId,
            courseId: program.id * 100 + courseIndex,
            isRequired: true,
            alternativeCourseIdsJson: "[]",
            notes:
              "U-M CoE-aligned planning requirement. Confirm exact department requirements, substitutions, and AP/transfer credit with Engineering Advising.",
          };
        });
      });
    }

    const plan =
      program.type === "major" ? majorCategoryPlan : minorCategoryPlan;
    let requirementOffset = 0;

    return plan.flatMap(([, , , , , courseIndexes], categoryIndex) => {
      const categoryId = program.id * 10 + categoryIndex + 1;
      return courseIndexes.map(courseIndex => {
        requirementOffset += 1;
        return {
          id: program.id * 100 + requirementOffset,
          categoryId,
          courseId: program.id * 100 + courseIndex,
          isRequired: true,
          alternativeCourseIdsJson: "[]",
          notes:
            "Representative generated requirement. Verify exact U-M catalog rules with an advisor or official department page.",
        };
      });
    });
  });

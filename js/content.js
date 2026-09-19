// ============================================================
//  YUAN27.top — content
//  V1: 内容集中在此文件。以后内容多了可迁移为外置 Markdown。
//  替换真实内容时，只需改这里的字符串（搜「← 替换此处」）。
//  待补充清单见 docs/2026-09-19-content-tofill.md
// ============================================================

export const LOGO = String.raw`
__   ___   _   _    _   _ ____ _____ _              
\ \ / / | | | / \  | \ | |___ \___  | |_ ___  _ __  
 \ V /| | | |/ _ \ |  \| | __) | / /| __/ _ \| '_ \ 
  | | | |_| / ___ \| |\  |/ __/ / /_| || (_) | |_) |
  |_|  \___/_/   \_\_| \_|_____/_/(_)\__\___/| .__/ 
                                             |_|    
`;

// 启动流程（2 秒内、可跳过）
export const BOOT_LINES = [
  'Initializing YUAN27...',
  'Loading profile modules...',
  'Mounting /about...',
  'Mounting /projects...',
  'Mounting /blog...',
  'Connection established.',
];

export const WELCOME = [
  'Welcome to YUAN27.top',
  'Type "help" to begin.',
];

export const WHOAMI = `YUAN

Computer Science Undergraduate
AI / Agent / Backend Development

Currently:
  → Building AI applications
  → Learning backend engineering
  → Exploring LLM / Agent systems`;

// ← 替换此处：neofetch 的个人信息（全部为占位，待补充真实值）
export const PROFILE = {
  user: 'YUAN27',
  host: 'yuan27.top',
  role: 'AI / Backend Developer', // ← 替换此处
  school: 'HUST', // ← 替换此处
  focus: 'Agent · RAG · Backend', // ← 替换此处
  projects: '12', // ← 替换此处
  blog: '24 posts', // ← 替换此处
  status: 'Building quietly', // ← 替换此处
};

// neofetch 左侧 ASCII 标识（figlet -f small "YUAN"）
export const NEOFETCH_ART = [
  '__   ___   _  _   _  _',
  '\\ \\ / / | | |/_\\ | \\| |',
  ' \\ V /| |_| / _ \\| .` |',
  '  |_|  \\___/_/ \\_\\_|\\_|',
].join('\n');

// ← 替换此处：彩蛋文案（coffee / sudo / fortune）
export const FUN = {
  coffee: [
    '',
    '     ( (',
    '      ) )',
    '   ........',
    '   |      |]',
    '   \\      /',
    "    `----'",
    '',
    'Coffee initialized.',
    'Productivity +10',
  ],
  sudoHire: [
    '[sudo] password for recruiter:',
    'Checking credentials...',
    'Access granted.',
    '',
    'Yuan is open to meaningful opportunities.',
    'Try: cat contact/links.md',
  ],
  fortunes: [
    'Talk is cheap. Show me the code.  — Linus Torvalds',
    'Simplicity is prerequisite for reliability.  — Edsger W. Dijkstra',
    'Premature optimization is the root of all evil.  — Donald Knuth',
    '（← 替换此处：加几句你自己的话）',
  ],
};

// ------------------------------------------------------------
// Virtual File System
//   file types:
//     { type:'file', content }           普通文本（cat 可读）
//     { type:'file', link:true, url }    链接文件（open 打开）
//     { type:'file', binary:true, url }  二进制文件（open 打开）
// ------------------------------------------------------------
export const FS = {
  type: 'dir',
  children: {
    'readme.md': {
      type: 'file',
      content: `# YUAN27.top

Hi! I'm YUAN — a Computer Science undergraduate building
AI agents and backend systems.

This site is a virtual Unix terminal. Try:

  neofetch          who am I
  help              all commands
  tree              the whole site
  cd about          go somewhere
  cat about/bio.md  read a file

Type 'help' to begin.
（← 替换此处：写一段欢迎语和站点导览）`,
    },

    // ---- hidden easter eggs（默认隐藏；ls -a / tree -a 可见）----
    '.secret': {
      type: 'file',
      content: `You found something that was not listed in the docs.

（← 替换此处：一句有趣的个人宣言）`,
    },
    '.note': {
      type: 'file',
      content: `给认真探索到这里的人：

（← 替换此处：一句话）`,
    },
    '.birthday': {
      type: 'file',
      content: `🎂 03-14

（← 替换此处：生日或纪念日彩蛋）`,
    },

    about: {
      type: 'dir',
      children: {
        'bio.md': {
          type: 'file',
          content: `# Bio

Hi, I'm YUAN.

Computer Science undergraduate. I spend most of my time on
AI agents, LLM applications, and backend engineering.

（← 替换此处：用一段话介绍你自己）`,
        },
        'education.md': {
          type: 'file',
          content: `# Education

- 2022 – 2026   B.Sc. Computer Science
- Coursework: OS, Computer Architecture, Database, Networks

（← 替换此处：学校、专业、时间、课程）`,
        },
        'skills.md': {
          type: 'file',
          content: `# Skills

- Languages: Python, C/C++, JavaScript, SQL
- Backend:   FastAPI, Node.js, PostgreSQL, Redis
- AI:        LLM, RAG, Agent frameworks
- Tools:     Linux, Docker, Git

（← 替换此处：你的技能栈）`,
        },
        'experience.md': {
          type: 'file',
          content: `# Experience

- Research / Internship / Project ...

（← 替换此处：实习、科研、项目经历）`,
        },
      },
    },

    projects: {
      type: 'dir',
      children: {
        agent: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# agent

An LLM-powered agent project.

- 简介: （← 替换此处）
- 技术栈: Python, LangChain, FastAPI
- 核心功能: （← 替换此处）
- 技术难点: （← 替换此处）
- 个人贡献: （← 替换此处）

Use 'open github' to open the repository.`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/yuan27/ai-agent',
            },
          },
        },
        rag: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# rag

Retrieval-Augmented Generation system.

- 简介: （← 替换此处）
- 技术栈: （← 替换此处）
- 核心功能: （← 替换此处）

Use 'open github' to open the repository.`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/yuan27/rag',
            },
          },
        },
        backend: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# backend

Backend service project.

- 简介: （← 替换此处）
- 技术栈: （← 替换此处）
- 核心功能: （← 替换此处）

Use 'open github' to open the repository.`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/yuan27/backend',
            },
          },
        },
        mips: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# mips

MIPS / CPU course design project.

- 简介: （← 替换此处）
- 技术栈: Verilog / Logisim ...
- 核心功能: （← 替换此处）

Use 'open github' to open the repository.`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/yuan27/cpu',
            },
          },
        },
        website: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# website

This very site — YUAN27.top, a terminal-style portfolio.

- 简介: A virtual Unix terminal as a personal website.
- 技术栈: Pure HTML + CSS + vanilla JS (ES Modules)

Use 'open github' to open the repository.`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/yuan27/yuan27.top',
            },
          },
        },
      },
    },

    blog: {
      type: 'dir',
      children: {
        ai: {
          type: 'dir',
          children: {
            'llm-agents.md': {
              type: 'file',
              content: `# LLM Agents 入门

（← 替换此处：正文）`,
            },
          },
        },
        cs: {
          type: 'dir',
          children: {
            'os-notes.md': {
              type: 'file',
              content: `# 操作系统笔记

（← 替换此处：正文）`,
            },
          },
        },
        thoughts: {
          type: 'dir',
          children: {
            'hello-world.md': {
              type: 'file',
              content: `# Hello World

第一篇文章。

（← 替换此处：正文）`,
            },
          },
        },
      },
    },

    resume: {
      type: 'dir',
      children: {
        'resume.pdf': {
          type: 'file',
          binary: true,
          url: 'assets/resume.pdf',
        },
      },
    },

    contact: {
      type: 'dir',
      children: {
        'links.md': {
          type: 'file',
          content: `# Contact

Email:  yuan@yuan27.top
GitHub: https://github.com/yuan27

（← 替换此处：联系方式）
Use 'open email' or 'open github' to follow the links.`,
        },
        email: {
          type: 'file',
          link: true,
          url: 'mailto:yuan@yuan27.top',
        },
        github: {
          type: 'file',
          link: true,
          url: 'https://github.com/yuan27',
        },
      },
    },
  },
};

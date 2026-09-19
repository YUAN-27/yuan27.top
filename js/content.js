// ============================================================
//  YUAN27.top — content
//  V1: 内容集中在此文件。以后内容多了可迁移为外置 Markdown。
//  替换真实内容时，只需改这里的字符串（搜「← 替换此处」）。
//  待补充清单见 docs/2026-09-19-content-tofill.md
// ============================================================

// ============================================================
//  站点字标（与 og 分享图 og.png 完全一致的表现形式）
//  YUAN = --text 前景色，27 = --dir 强调蓝，粗体大字号。
//  ← 替换此处：改 BRAND_NAME / BRAND_ACCENT / BRAND_NOTE 即可
// ============================================================
export const BRAND_NAME = 'YUAN';
export const BRAND_ACCENT = '27';
export const BRAND_NOTE = '# unix-terminal portfolio';

// 供 main.js 用 printLines（HTML 行）渲染，实现双色分段
export const WORDMARK_HTML =
  `<span class="wm-name">${BRAND_NAME}</span>` +
  `<span class="wm-num">${BRAND_ACCENT}</span>`;

export const LOGO = String.raw`
__   ___   _   _    _   _ ____ _____ _              
\ \ / / | | | / \  | \ | |___ \___  | |_ ___  _ __  
 \ V /| | | |/ _ \ |  \| | __) | / /| __/ _ \| '_ \ 
  | | | |_| / ___ \| |\  |/ __/ / /_| || (_) | |_) |
  |_|  \___/_/   \_\_| \_|_____/_/(_)\__\___/| .__/ 
                                             |_|    
`;

// 给启动 logo 加 ASCII 边框（╔═╗ 风格），返回逐行数组。
// 纯函数，行宽对齐；保持“逐行打印”的启动效果。
export function frameLogo(text, padX = 2) {
  const lines = String(text).split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const width = Math.max(...lines.map((l) => l.length));
  const pad = ' '.repeat(padX);
  const bar = '═'.repeat(width + padX * 2);
  return [
    '╔' + bar + '╗',
    ...lines.map((l) => '║' + pad + l.padEnd(width, ' ') + pad + '║'),
    '╚' + bar + '╝',
  ];
}

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

// 桌面入口映射：桌面图标 /（未来的）开始菜单、任务栏共用同一份配置。
// 硬规则：桌面线只服务桌面端；移动端不渲染这些入口（见 docs 1.3.1）。
export const ENTRIES = [
  { id: 'about', label: 'About', kind: 'folder', path: '/about' },
  { id: 'projects', label: 'Projects', kind: 'folder', path: '/projects' },
  { id: 'blog', label: 'Blog', kind: 'folder', path: '/blog' },
  { id: 'resume', label: 'Resume', kind: 'file', command: 'resume' },
  { id: 'contact', label: 'Contact', kind: 'folder', path: '/contact' },
  { id: 'readme', label: 'Readme.txt', kind: 'doc', command: 'cat readme.md' },
];

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

Name        agent
Summary     （← 替换此处：一句话说明这个项目是什么）
Tech Stack  Python · LangChain · FastAPI
Highlights  （← 替换此处：2–3 条亮点，用 · 分隔）
Links       'open github'
Status      （← 替换此处：进行中 / 已完成 / 已归档）`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/YUAN-27/agent',
            },
          },
        },
        rag: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# rag

Name        rag
Summary     （← 替换此处：一句话说明这个项目是什么）
Tech Stack  （← 替换此处）
Highlights  （← 替换此处：2–3 条亮点，用 · 分隔）
Links       'open github'
Status      （← 替换此处：进行中 / 已完成 / 已归档）`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/YUAN-27/rag',
            },
          },
        },
        backend: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# backend

Name        backend
Summary     （← 替换此处：一句话说明这个项目是什么）
Tech Stack  （← 替换此处）
Highlights  （← 替换此处：2–3 条亮点，用 · 分隔）
Links       'open github'
Status      （← 替换此处：进行中 / 已完成 / 已归档）`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/YUAN-27/backend',
            },
          },
        },
        mips: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# mips

Name        mips
Summary     （← 替换此处：一句话说明这个项目是什么）
Tech Stack  Verilog · Logisim（← 替换此处）
Highlights  （← 替换此处：2–3 条亮点，用 · 分隔）
Links       'open github'
Status      （← 替换此处：进行中 / 已完成 / 已归档）`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/YUAN-27/mips',
            },
          },
        },
        website: {
          type: 'dir',
          children: {
            'readme.md': {
              type: 'file',
              content: `# website

Name        website
Summary     YUAN27.top — 一个以终端为交互界面的个人站点
Tech Stack  HTML · CSS · Vanilla JS (ES Modules)
Highlights  零依赖零构建 · 虚拟文件系统 · 可拖动窗口 · 桌面氛围层
Links       'open github'
Status      进行中`,
            },
            github: {
              type: 'file',
              link: true,
              url: 'https://github.com/YUAN-27/yuan27.top',
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
              title: 'LLM Agents 入门',
              content: `# LLM Agents 入门

date    2026-01-01   （← 替换此处）
tags    LLM · Agent  （← 替换此处）
link    （← 替换此处：站外文章链接，填了就可用 'open' 打开）

（← 替换此处：正文）`,
            },
          },
        },
        cs: {
          type: 'dir',
          children: {
            'os-notes.md': {
              type: 'file',
              title: '操作系统笔记',
              content: `# 操作系统笔记

date    2026-01-01   （← 替换此处）
tags    OS · C        （← 替换此处）
link    （← 替换此处：站外文章链接）

（← 替换此处：正文）`,
            },
          },
        },
        thoughts: {
          type: 'dir',
          children: {
            'hello-world.md': {
              type: 'file',
              title: 'Hello World',
              content: `# Hello World

date    2026-01-01   （← 替换此处）
tags    thoughts     （← 替换此处）
link    （← 替换此处：站外文章链接）

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
GitHub: https://github.com/YUAN-27

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
          url: 'https://github.com/YUAN-27',
        },
      },
    },
  },
};

import React, { createContext, useContext, useMemo, useState } from 'react';

export type Locale = 'zh-CN' | 'en-US';

const LANGUAGE_KEY = 'wandou.locale';

const messages = {
  'zh-CN': {
    'app.restoreSession': '正在恢复登录态...',
    'language.current': '简体中文',
    'language.switch': '切换为英文',
    'nav.home': '首页',
    'nav.workspace': 'AI 创作',
    'nav.assets': '素材管理',
    'nav.usage': '积分用量',
    'nav.users': '用户管理',
    'nav.settings': '模型设置',
    'nav.logout': '退出登录',
    'nav.backHome': '返回首页',
    'badge.pro': '专业版',
    'badge.free': '免费',
    'home.bannerTitle': '豌豆智能创作台',
    'home.bannerDesc': '剧本、分镜、视频任务和资产流已接入同一工作台',
    'home.product': '豌豆工作室',
    'home.subtitle': 'AI 视频画布',
    'home.faq': '常见问题',
    'home.join': '加入创作项目',
    'home.languageNotice': '界面已切换为简体中文。',
    'home.faqNotice': '常见问题中心尚未接入。当前可以直接从首页输入创作指令开始验证链路。',
    'home.joinNotice': '加入已有项目需要邀请码/协作入口，当前请从最近项目列表打开已有项目。',
    'home.agentReady': '导演 Agent 待命',
    'home.promptPlaceholder': '输入你的短片想法，例如：少女抱着机器猫站在空间站窗前，窗外是星云，生成剧本、角色、分镜和视频任务...',
    'home.addAttachment': '添加附件',
    'home.referenceImage': '参考图',
    'home.agentMode': '智能体',
    'home.video': '视频',
    'home.script': '剧本',
    'home.start': '开始创作',
    'home.recentProjects': '最近项目',
    'home.newProject': '新建项目',
    'home.showAll': '查看全部',
    'home.collapse': '收起',
    'home.loadingProjects': '正在从后端加载项目...',
    'home.emptyProjects': '后端暂无项目。创建第一个项目后，它会出现在这里。',
    'home.highlights': '亮点',
    'home.close': '关闭',
    'home.attachmentNotice': '附件上传需要后端对象存储接口，当前请用文本描述参考图或在素材库登记外链。',
    'home.referenceNotice': '参考图上传尚未接入，当前可以在提示词中描述参考图，或到素材管理登记图片 URL。',
    'home.quick.story': '故事视频',
    'home.quick.canvas': '自由画布',
    'home.quick.character': '角色设定',
    'home.quick.storyboard': '分镜生成',
    'home.highlight.agent.title': 'Agent 编排',
    'home.highlight.agent.desc': '导演、剧本、分镜和视频任务会同步到会话、任务队列与画布节点。',
    'home.highlight.assets.title': '画布式资产流',
    'home.highlight.assets.desc': '每一次生成都会沉淀为可追踪节点，素材、任务和会话保持同一个上下文。',
  },
  'en-US': {
    'app.restoreSession': 'Restoring your session...',
    'language.current': 'English',
    'language.switch': 'Switch to Chinese',
    'nav.home': 'Home',
    'nav.workspace': 'AI Studio',
    'nav.assets': 'Assets',
    'nav.usage': 'Usage',
    'nav.users': 'Users',
    'nav.settings': 'Model Settings',
    'nav.logout': 'Log out',
    'nav.backHome': 'Back home',
    'badge.pro': 'PRO',
    'badge.free': 'Free',
    'home.bannerTitle': 'Wandou Agent Studio',
    'home.bannerDesc': 'Scripts, storyboards, video tasks, and assets now share one workspace.',
    'home.product': 'Wandou Studio',
    'home.subtitle': 'AI video canvas',
    'home.faq': 'FAQ',
    'home.join': 'Join project',
    'home.languageNotice': 'The interface is now in English.',
    'home.faqNotice': 'The FAQ center is not connected yet. Start by entering a creation prompt on the home page.',
    'home.joinNotice': 'Joining existing projects needs invite/collaboration support. Open an existing project from Recent Projects for now.',
    'home.agentReady': 'Director Agent ready',
    'home.promptPlaceholder': 'Enter a short-film idea, for example: a girl holding a robot cat in front of a space-station window, nebula outside, generate script, characters, storyboard, and video tasks...',
    'home.addAttachment': 'Add attachment',
    'home.referenceImage': 'Reference image',
    'home.agentMode': 'Agent',
    'home.video': 'Video',
    'home.script': 'Script',
    'home.start': 'Start creating',
    'home.recentProjects': 'Recent Projects',
    'home.newProject': 'New Project',
    'home.showAll': 'Show all',
    'home.collapse': 'Collapse',
    'home.loadingProjects': 'Loading projects from backend...',
    'home.emptyProjects': 'No projects yet. Your first project will appear here.',
    'home.highlights': 'Highlights',
    'home.close': 'Close',
    'home.attachmentNotice': 'Attachment upload needs object-storage support. Describe references in text or register image URLs in Assets for now.',
    'home.referenceNotice': 'Reference image upload is not connected yet. Describe it in the prompt or register an image URL in Assets.',
    'home.quick.story': 'Story Video',
    'home.quick.canvas': 'Free Canvas',
    'home.quick.character': 'Character Design',
    'home.quick.storyboard': 'Storyboard',
    'home.highlight.agent.title': 'Agent Orchestration',
    'home.highlight.agent.desc': 'Director, script, storyboard, and video tasks are synced into conversations, task queues, and canvas nodes.',
    'home.highlight.assets.title': 'Canvas Asset Flow',
    'home.highlight.assets.desc': 'Every generation becomes a traceable node while assets, tasks, and conversations share the same context.',
  },
} as const;

type MessageKey = keyof typeof messages['zh-CN'];

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function initialLocale(): Locale {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === 'en-US' ? 'en-US' : 'zh-CN';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: Locale) => {
      localStorage.setItem(LANGUAGE_KEY, nextLocale);
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
    };
    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'),
      t: (key) => messages[locale][key] || messages['zh-CN'][key] || key,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

package com.wandou.ai.agent.runtime;

public enum VideoAgentStep {
    DIRECTOR("导演规划", "director"),
    SCRIPT("剧本生成", "script"),
    CHARACTER("角色设定", "character"),
    STORYBOARD("分镜设计", "storyboard"),
    VISUAL("关键帧设计", "visual"),
    AUDIO("声音设计", "audio"),
    REVIEW("质量审查", "review"),
    EXPORT("成片合成", "export");

    private final String title;
    private final String code;

    VideoAgentStep(String title, String code) {
        this.title = title;
        this.code = code;
    }

    public String title() {
        return title;
    }

    public String code() {
        return code;
    }
}

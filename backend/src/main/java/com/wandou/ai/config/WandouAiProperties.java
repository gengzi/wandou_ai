package com.wandou.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "wandou.ai")
public class WandouAiProperties {

    private Cors cors = new Cors();
    private Agent agent = new Agent();
    private Usage usage = new Usage();

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public Agent getAgent() {
        return agent;
    }

    public void setAgent(Agent agent) {
        this.agent = agent;
    }

    public Usage getUsage() {
        return usage;
    }

    public void setUsage(Usage usage) {
        this.usage = usage;
    }

    public static class Cors {
        private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173"));

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Agent {
        private AgentMonitor monitor = new AgentMonitor();

        public AgentMonitor getMonitor() {
            return monitor;
        }

        public void setMonitor(AgentMonitor monitor) {
            this.monitor = monitor;
        }
    }

    public static class AgentMonitor {
        private boolean enabled = true;
        private boolean sseEnabled = true;
        private long minPublishIntervalMs = 1000;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public boolean isSseEnabled() {
            return sseEnabled;
        }

        public void setSseEnabled(boolean sseEnabled) {
            this.sseEnabled = sseEnabled;
        }

        public long getMinPublishIntervalMs() {
            return minPublishIntervalMs;
        }

        public void setMinPublishIntervalMs(long minPublishIntervalMs) {
            this.minPublishIntervalMs = minPublishIntervalMs;
        }
    }

    public static class Usage {
        private int initialCredits = 1200;
        private UsageCredits credits = new UsageCredits();

        public int getInitialCredits() {
            return initialCredits;
        }

        public void setInitialCredits(int initialCredits) {
            this.initialCredits = initialCredits;
        }

        public UsageCredits getCredits() {
            return credits;
        }

        public void setCredits(UsageCredits credits) {
            this.credits = credits;
        }
    }

    public static class UsageCredits {
        private int text = 1;
        private int image = 8;
        private int video = 50;
        private int audio = 4;

        public int getText() {
            return text;
        }

        public void setText(int text) {
            this.text = text;
        }

        public int getImage() {
            return image;
        }

        public void setImage(int image) {
            this.image = image;
        }

        public int getVideo() {
            return video;
        }

        public void setVideo(int video) {
            this.video = video;
        }

        public int getAudio() {
            return audio;
        }

        public void setAudio(int audio) {
            this.audio = audio;
        }
    }
}

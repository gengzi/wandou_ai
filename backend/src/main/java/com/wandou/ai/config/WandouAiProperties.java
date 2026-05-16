package com.wandou.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "wandou.ai")
public class WandouAiProperties {

    private Cors cors = new Cors();
    private Agent agent = new Agent();

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
}

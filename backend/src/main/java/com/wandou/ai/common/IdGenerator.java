package com.wandou.ai.common;

import java.util.UUID;

public final class IdGenerator {

    private IdGenerator() {
    }

    public static String id(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    public static String longId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "");
    }
}

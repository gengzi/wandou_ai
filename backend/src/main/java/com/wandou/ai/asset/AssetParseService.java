package com.wandou.ai.asset;

import org.apache.tika.Tika;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.Locale;

@Service
public class AssetParseService {

    private static final int MAX_PARSE_CHARS = 60_000;
    private static final int SUMMARY_CHARS = 700;

    private final Tika tika = new Tika();

    public ParseResult parse(String filename, String contentType, String purpose, byte[] bytes) {
        if (!"script_source".equals(purpose)) {
            return ParseResult.notRequired();
        }
        if (bytes == null || bytes.length == 0) {
            return ParseResult.failed("文件内容为空");
        }
        if (!isSupportedScriptFile(filename, contentType)) {
            return ParseResult.failed("暂不支持该剧本文档格式");
        }
        try {
            String text = tika.parseToString(new ByteArrayInputStream(bytes));
            String normalized = normalizeText(text);
            if (normalized.isBlank()) {
                return ParseResult.failed("未能从文件中提取到文本");
            }
            String clipped = normalized.length() > MAX_PARSE_CHARS
                    ? normalized.substring(0, MAX_PARSE_CHARS)
                    : normalized;
            return ParseResult.parsed(clipped, summarize(clipped));
        } catch (Exception error) {
            return ParseResult.failed(error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage());
        }
    }

    public boolean isSupportedScriptFile(String filename, String contentType) {
        String lowerName = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        String lowerContentType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return lowerName.endsWith(".txt")
                || lowerName.endsWith(".md")
                || lowerName.endsWith(".pdf")
                || lowerName.endsWith(".docx")
                || lowerContentType.startsWith("text/")
                || lowerContentType.contains("pdf")
                || lowerContentType.contains("wordprocessingml.document");
    }

    private static String normalizeText(String text) {
        return text == null
                ? ""
                : text.replace('\u00A0', ' ')
                        .replaceAll("[\\t\\x0B\\f\\r]+", " ")
                        .replaceAll(" *\\n *", "\n")
                        .replaceAll("\\n{3,}", "\n\n")
                        .trim();
    }

    private static String summarize(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String singleLine = text.replaceAll("\\s+", " ").trim();
        return singleLine.length() > SUMMARY_CHARS
                ? singleLine.substring(0, SUMMARY_CHARS) + "..."
                : singleLine;
    }

    public record ParseResult(
            String status,
            String text,
            String summary,
            String error
    ) {
        public static ParseResult notRequired() {
            return new ParseResult("not_required", null, null, null);
        }

        public static ParseResult parsed(String text, String summary) {
            return new ParseResult("parsed", text, summary, null);
        }

        public static ParseResult failed(String error) {
            return new ParseResult("failed", null, null, error);
        }
    }
}

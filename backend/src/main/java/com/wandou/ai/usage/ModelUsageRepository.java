package com.wandou.ai.usage;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ModelUsageRepository extends JpaRepository<ModelUsageRecord, String> {
    List<ModelUsageRecord> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    Page<ModelUsageRecord> findPageByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    @Query("select coalesce(sum(record.credits), 0) from ModelUsageRecord record where record.userId = :userId")
    long sumCreditsByUserId(String userId);

    long countByUserId(String userId);
}

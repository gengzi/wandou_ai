package com.wandou.ai.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {
    List<ProjectEntity> findAllByOrderByCreatedAtDesc();

    Page<ProjectEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

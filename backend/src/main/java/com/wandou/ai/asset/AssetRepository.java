package com.wandou.ai.asset;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssetRepository extends JpaRepository<AssetEntity, String> {
    List<AssetEntity> findByProjectIdOrderByCreatedAtDesc(String projectId);

    @Query("""
            select asset from AssetEntity asset
            where (
                    :projectId is null or :projectId = ''
                    or (:projectId = '__unassigned__' and (asset.projectId is null or asset.projectId = ''))
                    or asset.projectId = :projectId
                  )
              and (:type is null or :type = '' or :type = 'all' or asset.type = :type)
              and (
                    :keyword is null or :keyword = ''
                    or lower(asset.name) like lower(concat('%', :keyword, '%'))
                    or lower(asset.type) like lower(concat('%', :keyword, '%'))
                    or lower(coalesce(asset.projectId, '')) like lower(concat('%', :keyword, '%'))
                    or lower(coalesce(asset.nodeId, '')) like lower(concat('%', :keyword, '%'))
              )
            """)
    Page<AssetEntity> search(
            @Param("projectId") String projectId,
            @Param("type") String type,
            @Param("keyword") String keyword,
            Pageable pageable
    );
}

package com.wandou.ai.asset;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssetRepository extends JpaRepository<AssetEntity, String> {
    List<AssetEntity> findByProjectIdOrderByCreatedAtDesc(String projectId);

    List<AssetEntity> findByProjectIdAndPurposeOrderByCreatedAtDesc(String projectId, String purpose);

    List<AssetEntity> findByProjectIdAndPurposeAndParseStatusOrderByCreatedAtDesc(String projectId, String purpose, String parseStatus);

    @Query("""
            select asset from AssetEntity asset
            where (asset.objectKey is null or asset.objectKey = '')
              and asset.url is not null
              and asset.url <> ''
              and asset.status <> 'external_import_failed'
              and (lower(asset.url) like 'http://%' or lower(asset.url) like 'https://%')
            order by asset.createdAt desc
            """)
    List<AssetEntity> findExternalOnlyAssets(Pageable pageable);

    @Modifying
    @Query("update AssetEntity asset set asset.status = :status where asset.id = :assetId")
    int markStatus(@Param("assetId") String assetId, @Param("status") String status);

    @Modifying
    @Query("""
            update AssetEntity asset
            set asset.url = :url,
                asset.thumbnailUrl = :thumbnailUrl,
                asset.objectKey = :objectKey,
                asset.thumbnailObjectKey = :thumbnailObjectKey,
                asset.contentType = :contentType,
                asset.thumbnailContentType = :thumbnailContentType,
                asset.sizeBytes = :sizeBytes,
                asset.status = :status
            where asset.id = :assetId
            """)
    int markStored(
            @Param("assetId") String assetId,
            @Param("url") String url,
            @Param("thumbnailUrl") String thumbnailUrl,
            @Param("objectKey") String objectKey,
            @Param("thumbnailObjectKey") String thumbnailObjectKey,
            @Param("contentType") String contentType,
            @Param("thumbnailContentType") String thumbnailContentType,
            @Param("sizeBytes") long sizeBytes,
            @Param("status") String status
    );

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

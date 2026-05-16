package com.wandou.ai.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserAccount, String> {

    Optional<UserAccount> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByActiveTrue();

    @Query("""
            select count(distinct user) from UserAccount user
            join user.roles role
            where role.code = :role
            """)
    long countByRole(@Param("role") String role);

    @Query("""
            select distinct user from UserAccount user
            left join user.roles role
            where (:keyword is null or :keyword = ''
                   or lower(user.name) like lower(concat('%', :keyword, '%'))
                   or lower(user.email) like lower(concat('%', :keyword, '%')))
              and (:role is null or :role = '' or :role = 'all' or role.code = :role)
              and (:status is null or :status = '' or :status = 'all'
                   or (:status = 'active' and user.active = true)
                   or (:status = 'disabled' and user.active = false))
            """)
    Page<UserAccount> search(
            @Param("keyword") String keyword,
            @Param("role") String role,
            @Param("status") String status,
            Pageable pageable
    );
}

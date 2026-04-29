SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS drive_files_temp;

CREATE TEMPORARY TABLE drive_files_temp (
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf'
);

INSERT INTO drive_files_temp (file_name, drive_file_id, mime_type)
VALUES
('91201250200 - ALEILSON DE SOUZA RIBEIRO 04-2026.pdf', '19SumaP03JVfdggUWwKJ2wp3wWnH6MJKx', 'application/pdf'),
('08053133207 - ALEXANDRE NASCIMENTO DO NASCIMENTO 04-2026.pdf', '1E9WmvBAzuy2RxO2jCT6rbvQXpN1Gb00D', 'application/pdf'),
('95890190210 - ANA PAULA JEAN COSTA 04-2026.pdf', '1WytcZYsu8rJ0cggkw1773Qu06lQ-V3av', 'application/pdf'),
('05837033807 - ANTONIO CARLOS RODRIGUES DE OLIVEIRA 04-2026.pdf', '1P86JKtu7W14OHXfrJ6-k3h1Wy5AqpL5u', 'application/pdf'),
('82191646204 - CLEBER FERNANDO DE SOUZA BARATA 04-2026.pdf', '1ihO8c8-V2p2yHSLaY0FLLN1iD1fHkl-K', 'application/pdf'),
('93591748234 - EDJANDESON DA SILVA CAVALCANTE 04-2026.pdf', '14Sa1mc6sV9BkRajyc03btfIszg9aqbJK', 'application/pdf'),
('06280348229 - EDUARDO HENRIQUE DOS SANTOS GOMES 04-2026.pdf', '1l7GWcYwfB-lyOuC3-HEDvewiVM7P4b7x', 'application/pdf'),
('29215365877 - EDUARDO RIBEIRO BRAGA 04-2026.pdf', '1xTkw4k2dmmrqwcPup36f9c_2QBh8NcFr', 'application/pdf'),
('06062434298 - EMILY DE SOUZA AMARAL 04-2026.pdf', '1zQhTWAEUfYEr7CiotERogLYjWVPo3uIl', 'application/pdf'),
('82555222200 - ERISS DA SILVA BATISTA 04-2026.pdf', '18ntu2OTHew7JC7M2McSN4bOlcqZfxXCo', 'application/pdf'),
('93365128549 - GILSON BARBOSA DOS SANTOS 04-2026.pdf', '1_7AT9Yvz-pJj47qYer0E5tqxenThEynu', 'application/pdf'),
('05427280529 - IAGO DA SILVA DE JESUS 04-2026.pdf', '1XohI9VnzmZXMKemvkSGEPvBKHUdzZu4h', 'application/pdf'),
('70468975225 - ISAAC ROCHA DE MENDONCA JUNIOR 04-2026.pdf', '1OXIWx9eCUNGZqOIs-W__e4eJjYOyeQEG', 'application/pdf'),
('70130254290 - JARDEL GERALDO DE OLIVEIRA FILHO 04-2026.pdf', '1gc30DPoYWooH7iV5gwDR2EU0V_tEROLQ', 'application/pdf'),
('00176556257 - JOAO DE SOUZA CIDADE 04-2026.pdf', '1gP98VhmF2Vc-3DxoCpwkNxz8TRQ8SIN5', 'application/pdf'),
('02471369219 - LIS VITORIA COSTA RODRIGUES 04-2026.pdf', '1lBJqAjhGIn60zknZ9-DGy-qBTG11vnk1', 'application/pdf'),
('00404279511 - MICHEL AMORIM BAHIA 04-2026.pdf', '1fnNKRNLDOD0dcmZes-rL7GaFxDwITuQl', 'application/pdf'),
('00968604218 - RAIMUNDO JOSE RODRIGUES 04-2026.pdf', '1RxO7MQbWw_HTdj_z-14_-g86otsrdmQy', 'application/pdf'),
('88991873200 - SABRINA SUELLEN DA SILVA JATI 04-2026.pdf', '1GC-pasPyNTdsGL5fgbiKk-7gxM8DFD94', 'application/pdf');

INSERT INTO contracheques
(
    user_id,
    mes,
    ano,
    file_name,
    original_name,
    drive_file_id,
    mime_type,
    file_path,
    created_at,
    is_active
)
SELECT
    u.id AS user_id,
    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(d.file_name, '.pdf', ''), ' ', -1), '-', 1) AS UNSIGNED) AS mes,
    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(d.file_name, '.pdf', ''), ' ', -1), '-', -1) AS UNSIGNED) AS ano,
    d.file_name AS file_name,
    d.file_name AS original_name,
    d.drive_file_id AS drive_file_id,
    COALESCE(d.mime_type, 'application/pdf') AS mime_type,
    NULL AS file_path,
    NOW() AS created_at,
    1 AS is_active
FROM drive_files_temp d
INNER JOIN users u
    ON LPAD(REPLACE(REPLACE(REPLACE(TRIM(CAST(u.cpf AS CHAR)), '.', ''), '-', ''), ' ', ''), 11, '0') = LEFT(d.file_name, 11)
WHERE NOT EXISTS (
    SELECT 1
    FROM contracheques c
    WHERE c.drive_file_id = d.drive_file_id
       OR (
            c.user_id = u.id
            AND c.mes = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(d.file_name, '.pdf', ''), ' ', -1), '-', 1) AS UNSIGNED)
            AND c.ano = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(d.file_name, '.pdf', ''), ' ', -1), '-', -1) AS UNSIGNED)
       )
);

-- Conferir arquivos do Drive que não encontraram usuário pelo CPF
SELECT
    d.file_name,
    LEFT(d.file_name, 11) AS cpf_extraido
FROM drive_files_temp d
LEFT JOIN users u
    ON LPAD(REPLACE(REPLACE(REPLACE(TRIM(CAST(u.cpf AS CHAR)), '.', ''), '-', ''), ' ', ''), 11, '0') = LEFT(d.file_name, 11)
WHERE u.id IS NULL;

-- Conferir total de arquivos, total encontrados em users e total que ficaram linkados na tabela contracheques
SELECT
    (SELECT COUNT(*) FROM drive_files_temp) AS total_arquivos_drive,
    COUNT(DISTINCT u.id) AS usuarios_encontrados,
    COUNT(DISTINCT c.id) AS contracheques_linkados
FROM drive_files_temp d
LEFT JOIN users u
    ON LPAD(REPLACE(REPLACE(REPLACE(TRIM(CAST(u.cpf AS CHAR)), '.', ''), '-', ''), ' ', ''), 11, '0') = LEFT(d.file_name, 11)
LEFT JOIN contracheques c
    ON c.drive_file_id = d.drive_file_id;
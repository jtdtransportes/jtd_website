SET NAMES utf8mb4;

CREATE TEMPORARY TABLE drive_files_temp (
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf'
);

INSERT INTO drive_files_temp (file_name, drive_file_id, mime_type)
VALUES
('06250544585 - REYNOLD DOS SANTOS MOTA 04-2026.pdf', '16LxcIKoSHo38qmOUzG-z8JQNiHQNusb0', 'application/pdf'),
('05878629550 - DIEGO MACHADO RIBEIRO 04-2026.pdf', '1sgYFGvbBmubTVeZ6zOluTY0eWJHq-2EM', 'application/pdf'),
('05985821501 - JOSE NEPONUCENO TEIXEIRA JUNIOR 04-2026.pdf', '1ttYkjVh5j0fTMpWBK3ArD-oIzowPw38t', 'application/pdf'),
('06508110543 - JEFFERSON DE OLIVEIRA RODRIGUES 04-2026.pdf', '1PaUv87yFsQPQUQ3QlE4roqObR0CU40cT', 'application/pdf'),
('96318716572 - ADAILTON CERQUEIRA DOS SANTOS 04-2026.pdf', '1LDszYBIus9juDr2cRQJUrHbow3VPe_dA', 'application/pdf'),
('04141659509 - ADRIANA ALVES DE FRANÇA 04-2026.pdf', '16Q-vPJUWgB3REdttOSoaLI6KVTessUrc', 'application/pdf'),
('53895096504 - JURACI DE MELO RODRIGUES SOARES 04-2026.pdf', '1MqTqorwlZzrUsxpeP94o96I6YMKkbICj', 'application/pdf'),
('67641865534 - EVANDRO MACEDO LIMA 04-2026.pdf', '1wYH8YRnmPv1Vj9GHgjnX__rk5UayQ1Bn', 'application/pdf'),
('89976371500 - RONILDO SANTOS COSTA 04-2026.pdf', '1J1Y0taPWgQrN6y2fjV-8kxnQViK3N7MR', 'application/pdf'),
('02788753519 - JOAO PAULO DE OLIVEIRA NETO 04-2026.pdf', '1O7NGk9Mph_spPXGBaf5E4F1jHnBKTvHo', 'application/pdf'),
('85984757508 - TAIANE SOUSA DE LIMA 04-2026.pdf', '110ZF_xR0Et5hqwWztb3e0ej9XZ6TegrE', 'application/pdf'),
('74223577891 - BENEDITO CEZARIO 04-2026.pdf', '1Sll3BA8vieT1c14QT0vfwEf_dKUdXHKW', 'application/pdf'),
('03781819558 - CRISTIANO SANTOS DE QUEIROZ 04-2026.pdf', '1StzAKBssniIBC8UXQ5unGo_gpN2z9jwO', 'application/pdf'),
('94386587500 - LECIANO SOARES PACHECO 04-2026.pdf', '1Bn6cCOBkBZs9Mt_sg4AbIqvgCsPyZaIP', 'application/pdf'),
('06271678530 - RAY VIEIRA DOS SANTOS 04-2026.pdf', '1tv8mHjLAzuk8ibjbfrqD9Xtu7F9Pa_Zv', 'application/pdf'),
('07301176503 - JESSICA SOUZA DA CRUZ LIMA 04-2026.pdf', '1_cN75vQROZcfzW7Y9sQ8YAgOIbx3KFBI', 'application/pdf'),
('01385397586 - MANUELA CIDREIRA DE ALMEIDA SANTOS 04-2026.pdf', '1CIkf4EQcNV9vKAJ0oTGucLVPdF0Aa2av', 'application/pdf'),
('07307783550 - EDUARDO DE JESUS SANTOS 04-2026.pdf', '1odEc9Rp1f4asx_AoJfKb5umYaJgdLjOr', 'application/pdf'),
('79372198404 - ERINALDO JOSE BEZERRA DA SILVA 04-2026.pdf', '1itNC60mZ5Q8a_eXO5GsL_qaR4NCu_YAP', 'application/pdf'),
('10113300590 - ELVIS CARLOS OLIVEIRA SANTOS 04-2026.pdf', '1cnZxcUbvBn07VxbXZzG6f_f_OKBnIdvQ', 'application/pdf'),
('08034531596 - GUILHERME SOUZA DE ARAUJO 04-2026.pdf', '1ak8emX7usPFeKqbOmftVMXi1Xs5DrA7B', 'application/pdf'),
('77812875504 - SILVANA BOMFIM SANTANA 04-2026.pdf', '14p1o4a7sBqGR-6xnJpFIC3ishLwqiZQ6', 'application/pdf'),
('10473496550 - GABRIEL COSTA SANTOS 04-2026.pdf', '1hU6RNk-jgYE3ZGDqyGz-WLC2MN4jLWs3', 'application/pdf'),
('00406943567 - CLEDSON PAPA DE SOUSA 04-2026.pdf', '1zz-DQ-mf9ZKt9_-1iie9QrjPHDrGQwLK', 'application/pdf'),
('02580899545 - RONALDO REZENDE NECO 04-2026.pdf', '1TtUASJH87RthME1K_r9QXl7543EiMo4D', 'application/pdf'),
('07462635542 - ROSANA OLIVEIRA DOS SANTOS 04-2026.pdf', '1kPKECfMyJSb2jG1jlz9OJoE2mk9fnLZa', 'application/pdf'),
('02446038476 - LUCIO MARIO DA SILVA 04-2026.pdf', '1e7JKuDpDK0jFZLgLKVFDgUensbFkcxDE', 'application/pdf'),
('05495420519 - ICARO EDUARDO DA SILVA DE SOUZA 04-2026.pdf', '1KX3LkoweviuJsj6CiPUHfoGX0n65Ly71', 'application/pdf'),
('79646301568 - RENE RIBEIRO DOS SANTOS 04-2026.pdf', '1TC-8ybDJLaBlnoOPPhCQRSVL_vNQU_iv', 'application/pdf'),
('96203501549 - ERIVALDO CARNEIRO DE CARVALHO 04-2026.pdf', '1Dypxhoq1TPbh0MmmrZ5da9z4IcQlAL_T', 'application/pdf'),
('01077982550 - ANDERSON DA CRUZ MIRANDA 04-2026.pdf', '1QKCIBkddlX4KWustHZdBdyFP-OIpklAN', 'application/pdf'),
('04808034557 - JOANDERSON DOS SANTOS 04-2026.pdf', '1zl3zptNeS25a3IU3GDy7oVVkQqL0QUBM', 'application/pdf'),
('90296761591 - EDIVALDO BORGES SANTOS 04-2026.pdf', '1avQyovQUh-1g_UXyaeXBvrcA2kHnYvaO', 'application/pdf'),
('06538841503 - MARIA DAS GRACAS SOARES DE CARVALHO 04-2026.pdf', '1G3V8cZdmToPDXK513uymuOv424TTIagS', 'application/pdf'),
('06237491570 - UALAS RIBEIRO DE ALMEIDA 04-2026.pdf', '1p2sQsQNTZTWBmwWNz6OQQwA7ovxnuiaZ', 'application/pdf'),
('10045100551 - DANILO SILVA DOS SANTOS 04-2026.pdf', '1IE1O_OQa-VZ9ZxcOmo2bGjgXAxAm1TXB', 'application/pdf'),
('05705082584 - PAULO SERGIO DE JESUS PINHEIRO 04-2026.pdf', '1Jcp-elf2zWKy_KLLkUoUDxgOuUS2wH5X', 'application/pdf'),
('98853147504 - UALNEY AGOSTINHO GONÇALVES 04-2026.pdf', '1ntEycMIq8ehAo74db_g1pWuZP8nPjvo5', 'application/pdf'),
('04288935547 - RENILDO DE SANTANA FILHO 04-2026.pdf', '16ArQFOMnJmmLv8dYy9XW6NvKsuJiV-4X', 'application/pdf'),
('00682154520 - JOSEMIR ALVES DE ALMEIDA 04-2026.pdf', '12PI51W7naEX9n9oVkFmOss6Zk7toWUXf', 'application/pdf'),
('84649615291 - ERONILDES ARAUJO SARDINHA 04-2026.pdf', '1F7PQE1r0Mbi4nx4DCl7dOUv5nNUDhrL2', 'application/pdf'),
('94351317515 - CARLOS ALEIXANDRE ALMIDA DE MORAES 04-2026.pdf', '13ey0X-MCHrwC09A0WDyMqGABRGzuwF4x', 'application/pdf'),
('01697855563 - GEANDERSON ALVES DE JESUS 04-2026.pdf', '1NvYcBnfrUgOvl2yecCsqJWjBeTG12DoC', 'application/pdf'),
('50054258880 - JULIA LUIZA RODRIGUES DE SOUZA 04-2026.pdf', '1WlP8F7NZG7C9UAKSWBzCGT6psAFkEL3r', 'application/pdf'),
('92642322572 - ELOILTON DE OLIVEIRA MOTA 04-2026.pdf', '1CBJTEkWLqeCjXO9DjQ4yX44rGXSU_a8o', 'application/pdf'),
('09566042507 - DENILSON SALES DOS SANTOS 04-2026.pdf', '1tqiSnhv4crlo3eG_vEcKWInKTMq1qpXp', 'application/pdf'),
('86359765500 - WILLIAM DOS SANTOS DE JESUS 04-2026.pdf', '1R_Qq_guhmvFJsb7a2RzzuMVfJMhoTJn5', 'application/pdf'),
('38871413857 - ANDERSON SOUZA MATIAS 04-2026.pdf', '1ihKbwPdoVSiWzz97OrHmQiiToE7fMJgA', 'application/pdf'),
('07498344556 - VICTORIA KYMBERLLE DA SILVA MOREIRA 04-2026.pdf', '1dzIsIu9duvy-Qpe7h2hjHtOcx8lJ2xTF', 'application/pdf'),
('00279299575 - EDIVAN DE SENA MAGALHÃES 04-2026.pdf', '1q8r3dsL1RgnUN30FjjGhM1Zo1LiB76ma', 'application/pdf'),
('86512333535 - GABRIEL DIAS RIOS 04-2026.pdf', '1uhIPaz8u9pjRMvc13ueGNUsq0XEKwAmg', 'application/pdf'),
('02978085592 - LEANDRO RUVENAL DOS SANTOS 04-2026.pdf', '1PA4dGRzgMuRStdlvjPMf2xmtLHtnDrGj', 'application/pdf'),
('03948385564 - ARLANE DAMASCENO LOPES 04-2026.pdf', '1PtuU12krER2d274pucG1vvxZdN9VB6Bz', 'application/pdf'),
('10068442521 - CAIQUE SALES DOS SANTOS 04-2026.pdf', '1ADaliVSObTtl0grDCdmvk_xfI3lhcxlJ', 'application/pdf'),
('90228863520 - JOSE FABIO DA SILVA 04-2026.pdf', '1as6dFFJVtpNPsxWJf3fsgwKQf4ZNbz0C', 'application/pdf'),
('02441778560 - ECIELIO MACHADO SANTANA 04-2026.pdf', '1YFWTnPPFveUAaN1s8jj3qdQ0GqvW82LX', 'application/pdf'),
('52677591553 - RENISIA RIBEIRO DOS SANTOS 04-2026.pdf', '1aKHFYJQGSTh1gYcwuEuE3qI2n84yVa5v', 'application/pdf'),
('01793324573 - ARIANA CARLA BARBOSA DA SILVA 04-2026.pdf', '1eUNe8APhv_HEIlzZJN_VtzvdW7W2amK0', 'application/pdf'),
('07528838527 - JULIO DA CRUZ LIMA 04-2026.pdf', '1q04UpzTB5x4GEPBS7gm6C0bf92EKbFAF', 'application/pdf'),
('93114125549 - RODRIGO PORTO FERREIRA 04-2026.pdf', '1lmFwNWodePw8gQCHXS4ZJ-n6riaZFpB3', 'application/pdf'),
('86377586574 - ENDSON ATAIDE DA SILVA 04-2026.pdf', '1mqUFOVQwBqpbhib1evOBD9dKUeNYk1om', 'application/pdf'),
('06200347506 - UESLEI FERREIRA DA SILVA OLIVEIRA 04-2026.pdf', '1UiN65xW413Ay44Mb2TqLNSfYd1YhHdxJ', 'application/pdf'),
('06169711507 - NATALICIO SANTOS FERREIRA 04-2026.pdf', '1I7LYD9UecynhQSow5-waLekrk21qiL3g', 'application/pdf'),
('66556619272 - ALEXSANDRO DE SENA LIMA 04-2026.pdf', '1q664CT4T4NgG7TDGofW9IR3rAGoiGg5t', 'application/pdf'),
('08232183500 - JOSE CARLOS CARA NETO 04-2026.pdf', '1E50HbXUSuRn3njUFkAoi4GqKjo-nkfQZ', 'application/pdf'),
('38756316844 - MARIA CAROLINE GONCALVES 04-2026.pdf', '1-ix2YLCicMJ23zT3lesS52wrMfNfICap', 'application/pdf'),
('02427847550 - GUSTAVO ASSUNCAO DA SILVA 04-2026.pdf', '116rs5lRhJRNjHYxvRhJ2d-Oi0ToV3EK2', 'application/pdf'),
('06264696510 - JAMILE DOS SANTOS CONCEIÇÃO 04-2026.pdf', '1m8FbLbdxn6C0eQPxgy43uP45Q_-VF21i', 'application/pdf'),
('07046902500 - CRISTIANO VICTOR MORAES DA SILVA 04-2026.pdf', '1FbDvH4C9CHTT_bNkooYG59FcC4JRbf94', 'application/pdf'),
('01152309552 - RONICK CARNEIRO DE SOUZA 04-2026.pdf', '1lKcoGMkOwYnsoyxScGlmXS-mi3Sc9MT_', 'application/pdf'),
('07488851536 - PEDRO AURELIO FENANDO CARNEIRO 04-2026.pdf', '1iddef-vmQbtjnLddTFQFZrFpEA9yIc10', 'application/pdf'),
('63040654500 - JOSÉ MARIO CARVALHO REIS 04-2026.pdf', '1ZzUB9RMZImuEqXTZRQkAj1aRSDyFiYNf', 'application/pdf'),
('42522692291 - VILSON LOPES DA SILVA 04-2026.pdf', '1mqBC1l476XYkS6GkkzCQjKDSX_22pjY8', 'application/pdf'),
('88399419591 - FERNANDO DE LIMA 04-2026.pdf', '1x8FyD6UiaJWDtOuQQFvNEvPUdvc0ucH4', 'application/pdf'),
('66794064553 - ADRIANA CRISTINA MALHEIROS 04-2026.pdf', '1sOUxthOxfhvsmyt_xUBS3vJpAdXCPVgg', 'application/pdf'),
('02612282505 - YURI IANG ARAGÃO DE JESUS 04-2026.pdf', '1ytqyy4z287WlnV2-Z6uJZYsC9xxQrLac', 'application/pdf'),
('14303355640 - CAMILA DE CARVALHO AGUIAR 04-2026.pdf', '1SDwxPmJWAs5D0DQYZI0OWBbNxo8F1zOK', 'application/pdf'),
('00364059575 - EDINELSON JANJAO SALVIANO 04-2026.pdf', '1vafgp7aCZnKfX9Zvi6MeafwxXob81jpl', 'application/pdf'),
('06466746500 - GABRIEL CRUZ DA SILVA 04-2026.pdf', '17igFahnuy3IBswK_UL7j_cyuG3TVhhtJ', 'application/pdf'),
('86018288508 - RONNIELLE FERREIRA OLIVEIRA 04-2026.pdf', '1FBVkhY2YLqTWdQy18TmbEeeMB2OYF5RO', 'application/pdf'),
('52903218889 - JULIANA RODRIGUES DUARTE RUSSO 04-2026.pdf', '1AlPjkEVBsDsIRDYkhlpquFold4hRAhct', 'application/pdf'),
('42025451415 - MARIANO JOSE DA SILVA NASCIMENTO 04-2026.pdf', '1lSuO_84GYr8I_r77mH4-SaCcYQnvO-jM', 'application/pdf'),
('08227698590 - JEFFERSON BRENO DA SILVA CARNEIRO 04-2026.pdf', '1ZyPljsHle6kwOEH2oPJsBfQ_KNUiaYPZ', 'application/pdf'),
('03979073548 - LEANDRO DA CRUZ PEREIRA 04-2026.pdf', '1reKK_YLb6auclMMGD8ia6ds2wKh5rSJQ', 'application/pdf'),
('06251648570 - WILDSON DOS SANTOS RODRIGUES 04-2026.pdf', '1Ms7Otq56uNYMhEp5XYzyKiYPRRG8Asrb', 'application/pdf'),
('00939858517 - HUGO FERREIRA DE LIMA 04-2026.pdf', '1n5Cney2WTBd9fQ95b17QUxpR5Qq8Bdvs', 'application/pdf'),
('63353733515 - EDGARD DA SILVA VAZ 04-2026.pdf', '1vETukEpiYD30o_T-o88VbuWSi0rrmgWk', 'application/pdf'),
('93817592515 - AYALA MACHADO ARAUJO DE ANDRADE 04-2026.pdf', '1U92snLdQpspO7B8AFKnBpuzEgggxc_6a', 'application/pdf'),
('86145813512 - PAULO CONCEIÇÃO DOS SANTOS JUNIOR 04-2026.pdf', '1kuf2UPRZZbGQaRuVau26MPltwU5wX6oa', 'application/pdf'),
('01552117570 - MARCOS VINICIOS DE CASTRO BOAVENTURA FI 04-2026.pdf', '1JFLO5xibif3_zDFKOjZXjYsqXmTEjnoT', 'application/pdf'),
('58190848534 - LUIZ ALBERTO BATISTA DOS SANTOS 04-2026.pdf', '1f0YvRYgdJTzAoMoyvbLRcqK5knVuAMzk', 'application/pdf'),
('21134618549 - JOAO MARCOS GONCALVES CORREIA 04-2026.pdf', '1Kbyne90zXkoUOnrlySp7bZSG9MWN-j9G', 'application/pdf'),
('07736278555 - GISLANE BISPO OLIVEIRA 04-2026.pdf', '1C1vk2B4lUG-6BocA8PHmD5UXcirBwPP_', 'application/pdf'),
('05970006548 - JEFFERSON RIBEIRO PORTO 04-2026.pdf', '14Q77SiRuZgtf2BP4WwV-a11-0wdBkeNI', 'application/pdf'),
('61064920500 - HILTON SOUSA VIANA JUNIOR 04-2026.pdf', '1I4ImzAp2aFglIdxW6mNpvgGeXqELwUlu', 'application/pdf'),
('96334509500 - ERIVELTON GEORGE OLIVEIRA SANTOS 04-2026.pdf', '1RcUxzhHiofEGnS5PDdw7_cuRR2s9N2cY', 'application/pdf'),
('86869174539 - RONILSON DE JESUS SILVA 04-2026.pdf', '1cKIFrJkRztCLe9SmLzN--jR-dFGPFhrj', 'application/pdf'),
('30616260857 - SHIRLEY DE OLIVEIRA DUARTE 04-2026.pdf', '17D5GlIEWxADzWc1PT0o0Dtlk97ib1Iq2', 'application/pdf'),
('09102226570 - CAMILA DE ALMEIDA SOUZA 04-2026.pdf', '1AauWl9TsZihfirDqLHww1ILelrADVDf6', 'application/pdf'),
('03187440584 - BENNETH MIRANDA DA SILVA 04-2026.pdf', '1TPyK3K2fNqxBPCiJVhSWEIatLdKEYQX9', 'application/pdf'),
('04907879598 - KARINE MIRANDA DOS SANTOS 04-2026.pdf', '1aGTjd9FRkIgMv9rDl3mSmP7GcwmFAfpD', 'application/pdf'),
('07079618584 - DIEGO BATISTA OLIVEIRA 04-2026.pdf', '1EZoOpjr4BlycVzJmBftqSUksVuDI3GeR', 'application/pdf'),
('36930121568 - VALMIR LIMA BORGES 04-2026.pdf', '1A1GkkQDn6XO_q5S-VpAn7LfmBFYdRYCl', 'application/pdf'),
('02105932452 - MAURO FERNANDES VIEIRA NEVES FILHO 04-2026.pdf', '10QTxySqQv6J-Na68GdUrVyTeK5_-Zdb1', 'application/pdf'),
('79175813572 - ERIVALDO LUIZ DA PURIFICAÇÃO JUNIOR 04-2026.pdf', '1GNTxLKdjkv2qQ9_G6YKfbo3i1KOvTtuY', 'application/pdf'),
('08030361599 - LUAN DO ESPIRITO SANTO SOUZA 04-2026.pdf', '1Rfze_aXtHKNnd6VLdDpDNj4G1Qmmc1E5', 'application/pdf');

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

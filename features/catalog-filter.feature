Feature: Catalog filter

  Scenario: Filtering stock by genre
    Given there are products in multiple genres
    When a visitor filters by a specific genre
    Then only products in that genre are shown

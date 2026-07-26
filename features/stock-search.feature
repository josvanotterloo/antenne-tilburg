Feature: Stock search

  Scenario: Searching the catalog by artist
    Given there are products in the catalog
    When a visitor searches for an artist name
    Then only matching products are returned

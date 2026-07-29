Feature: Admin product management

  Scenario: Adding a new product
    Given an admin is logged in
    When they submit a new product form with valid data
    Then the product does not yet appear in the public catalog

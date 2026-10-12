Feature: Admin product management

  Scenario: Adding a new product with the default quantity is visible immediately
    Given an admin is logged in
    When they submit a new product form with valid data
    Then the product appears in the public catalog

  Scenario: Adding a new product with quantity 0 stays hidden
    Given an admin is logged in
    When they submit a new product form with quantity 0
    Then the product does not yet appear in the public catalog

  Scenario: Adjusting a hidden product's stock upward makes it visible
    Given an admin is logged in
    When they submit a new product form with quantity 0
    When they adjust its stock upward
    Then the product appears in the public catalog

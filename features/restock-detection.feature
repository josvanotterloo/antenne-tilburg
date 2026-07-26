Feature: Restock detection

  Scenario: Back in stock detection
    Given a product with quantity 0
    When the quantity is updated to greater than 0
    Then the product appears in the Back In Stock section

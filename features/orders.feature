Feature: Order management

  Scenario: Ordering and receiving a product end-to-end
    Given a product with a supplier is in the catalog
    When an admin quick-adds the product to a supply order
    When they set the order line's quantity to 4
    When they receive all 4 units
    Then the order no longer appears in the open orders overview
    Then the product's stock reflects the received quantity

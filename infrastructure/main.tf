provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "healthmonitor-rg"
  location = "West Europe"
}

resource "azurerm_storage_account" "main" {
  name                     = "hmstor${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "azurerm_app_service_plan" "main" {
  name                = "healthmonitor-func-plan"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "FunctionApp"
  sku {
    tier = "Dynamic"
    size = "Y1"
  }
}

resource "azurerm_function_app" "main" {
  name                       = "healthmonitor-funcapp"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  app_service_plan_id        = azurerm_app_service_plan.main.id
  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key
  version                    = "~4"
  os_type                    = "linux"

  site_config {
    linux_fx_version = "NODE|18"
  }
}

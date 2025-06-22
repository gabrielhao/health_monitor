terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

resource "azurerm_resource_group" "main" {
  name     = "healthmonitor-${random_string.suffix.result}-rg"
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

resource "azurerm_service_plan" "main" {
  name                = "healthmonitor-func-plan"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "Y1"
}
resource "azurerm_linux_function_app" "main" {
  name                       = "healthmonitor-funcapp"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key

  service_plan_id           = azurerm_service_plan.main.id

  site_config {
    application_stack {
      node_version = "18"
    }
  }
}
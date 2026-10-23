import frappe


"""
permission request data
{
    "modules": ["Accounting"],
    "role": ["Accounts User", "Accounts Manager"],
}
"""


def sync_domain(modules):
    frappe.db.set_value("Module Def", {}, "restrict_to_domain", "")

    DEFAULT_DOMAIN = "Subscription"
    if not frappe.db.exists("Domain", DEFAULT_DOMAIN):
        frappe.get_doc({"doctype": "Domain", "domain": DEFAULT_DOMAIN}).insert(
            ignore_permissions=True
        )

    for module in modules:
        frappe.db.set_value("Module Def", module, "restrict_to_domain", DEFAULT_DOMAIN)

    settings = frappe.get_doc("Domain Settings")
    settings.set("active_domains", [])
    settings.append("active_domains", {"domain": DEFAULT_DOMAIN})
    settings.save(ignore_permissions=True)

    frappe.db.commit()

def sync_roles(roles):
    ...

@frappe.whitelist(allow_guest=True)
def sync_permissions(data: dict):
    modules = data["modules"]
    roles = data["roles"]
    
    sync_domain(modules)
    sync_roles(roles)

    frappe.response["message"] = "success"
    frappe.response["detail"] = "Subscription synced Successfully"
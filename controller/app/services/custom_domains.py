import re
import socket
import ssl

import dns.exception
import dns.resolver

HOSTNAME = re.compile(r'^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')


def validate_domain(value, platform_suffix):
    """Return (normalised domain, None) or (None, reason a customer can act on)."""
    domain = str(value or '').strip().lower().rstrip('.')
    if not HOSTNAME.fullmatch(domain):
        return None, 'Enter a domain such as erp.yourcompany.com.'
    if re.fullmatch(r'[\d.]+', domain):
        return None, 'Enter a domain name, not an IP address.'
    if platform_suffix and (domain == platform_suffix or domain.endswith('.' + platform_suffix)):
        return None, f'Domains under {platform_suffix} are managed by us. Use your own domain.'
    return domain, None


def check_dns(domain, site_domain, proxy_ips, resolver=None):
    resolver = resolver or dns.resolver.Resolver()
    resolver.lifetime = 6
    try:
        for record in resolver.resolve(domain, 'CNAME'):
            if str(record.target).rstrip('.').lower() == site_domain.lower():
                return True, None
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
        pass
    except dns.exception.DNSException:
        return False, 'We could not reach DNS to check this domain. Try again in a minute.'
    try:
        addresses = {str(record) for record in resolver.resolve(domain, 'A')}
    except dns.resolver.NXDOMAIN:
        return False, f'{domain} does not exist in DNS yet. Add the record below, then verify again (changes can take a few minutes).'
    except dns.resolver.NoAnswer:
        return False, f'{domain} has no address record yet. Add the record below, then verify again.'
    except dns.exception.DNSException:
        return False, 'We could not reach DNS to check this domain. Try again in a minute.'
    if addresses & set(proxy_ips):
        return True, None
    return False, (f'{domain} points to {", ".join(sorted(addresses))}, not to this site. '
                   f'Point it at {site_domain} (CNAME) or {", ".join(proxy_ips)} (A record).')


def probe_certificate(domain, timeout=4):
    """True once the domain serves a valid TLS certificate for its own name."""
    try:
        with socket.create_connection((domain, 443), timeout=timeout) as raw:
            with ssl.create_default_context().wrap_socket(raw, server_hostname=domain):
                return True
    except (OSError, ssl.SSLError):
        return False

ssl = {
    key = "/etc/prosody/certs/privkey.pem";
    certificate = "/etc/prosody/certs/fullchain.pem";
}

admins = {}

s2s_secure_auth = true

limits = {
    c2s = {
        rate = "10kb/s";
    };
    s2sin = {
        rate = "30kb/s";
    };
}

authentication = "internal_hashed"

certificates = "certs"

VirtualHost "msg.lapizypixel.com"

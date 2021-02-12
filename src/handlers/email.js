const AWS = require('aws-sdk');
const forwardFrom = 'admin@fieldstat.us'
const {simpleParser} = require('mailparser');

async function forwardEmail (msgInfo, forwardTo) {
// don't process spam messages
    if (msgInfo.receipt.spamVerdict.status === 'FAIL' || msgInfo.receipt.virusVerdict.status === 'FAIL') {
        console.log('Message is spam or contains virus, ignoring.');
        return
    } 
//Rewrite From: header to contain sender's name, with forwarder's address.
    let fromText = msgInfo.mail.commonHeaders.from[0];

    fromText = fromText.replace(/<(.*)>/, '') + ' <' + forwardFrom + '>';

    let email = msgInfo.content;
    let headers = "From: " + fromText + "\r\n";
    headers += "Reply-To: " + msgInfo.mail.commonHeaders.from[0] + "\r\n";
    headers += "X-Original-To: " + msgInfo.mail.commonHeaders.to[0] + "\r\n";
//We show the original recipient in the to. This is ok, because the mail envelope contains the real destination.
    headers += "To: " + msgInfo.mail.commonHeaders.to + "\r\n";
    if (msgInfo.mail.commonHeaders.cc) {
        headers += "CC: " + msgInfo.mail.commonHeaders.cc + "\r\n";
    }
    headers += "Subject: " + msgInfo.mail.commonHeaders.subject + "\r\n";

    console.log(headers);

    if (email) {
        let res;
        res = email.match(/Content-Type:.+\s*boundary.*/);
        if (res) {
            headers += res[0] + "\r\n";
        } else {
            res = email.match(/^Content-Type:(.*)/m);
            if (res) {
                headers += res[0] + "\r\n";
            }
        }

        res = email.match(/^Content-Transfer-Encoding:(.*)/m);
        if (res) {
            headers += res[0] + "\r\n";
        }

        res = email.match(/^MIME-Version:(.*)/m);
        if (res) {
            headers += res[0] + "\r\n";
        }

        var splitEmail = email.split("\r\n\r\n");
        splitEmail.shift();

        email = headers + "\r\n" + splitEmail.join("\r\n\r\n");
    } else {
        email = headers + "\r\n" + "Empty email";
    }
    console.log(headers);
    const params = {
        RawMessage: {Data: email},
        Destinations: [forwardTo],
        Source: forwardFrom
    };

    console.log(params);

    const data = await new AWS.SES().sendRawEmail(params).promise()
    console.log('Sent with MessageId: ' + data.MessageId);
}


exports.snsHandler = async (event, context) => {
    try {
        for (const record of event.Records) {
            const message = JSON.parse(record.Sns.Message)
            const mail = await simpleParser(message.content)
            const mailTo = mail.to.text
            await forwardEmail(message, 'lemavisima.geral@gmail.com')            
        }
    } catch (err) { console.log(err) }
}

const PDFDocument = require('pdfkit');

function generateCertificate(user, stats, res) {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate_${user.username}.pdf`);

    doc.pipe(res);

    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#0d6efd').lineWidth(5).stroke();
    
    doc.fontSize(40).fillColor('#0d6efd').text('CERTIFICATE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).fillColor('black').text('OF ACHIEVEMENT', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(16).text('This certificate is proudly presented to', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(35).fillColor('#0d6efd').text(user.username, { align: 'center', underline: true });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('black').text('For outstanding progress in learning foreign languages on LanguageApp.', { align: 'center' });
    doc.moveDown(2);

    const startY = doc.y;
    
    doc.fontSize(16).text(`Total XP: ${stats.totalPoints}`, 150, startY);
    doc.text(`Tests Passed: ${stats.testsCount}`, 150, startY + 30);
    doc.text(`Words Learned: ${stats.learnedCount}`, 150, startY + 60);
    
    doc.text(`Achievements: ${stats.achievementsCount}`, 450, startY);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 450, startY + 30);

    doc.end();
}

module.exports = { generateCertificate };
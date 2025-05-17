/**
 * Lists buckets using the given Minio client.
 * @param {import('minio').Client} client
 */
function listBuckets(client) {
  client.listBuckets((err, buckets) => {
    if (err) {
      console.error('Error listing buckets:', err);
      return;
    }
    console.log('Buckets:', buckets);
  });
}

module.exports = {
  listBuckets
}; 
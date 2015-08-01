AWS.config(
  access_key_id: 'AKIAIDJLHOPQWJ62VRQQ',
  secret_access_key: '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'
)
S3_BUCKET =  AWS::S3.new.buckets['while_true']

AWS_CONFIG = {
  'access_key_id' => 'AKIAIDJLHOPQWJ62VRQQ',
  'secret_access_key' => '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',
  'bucket' => 'while_true',
  'acl' => 'public-read',
  'key_start' => 'post_uploads/'
}
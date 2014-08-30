CarrierWave.configure do |config|
  config.fog_credentials = {
    :provider               => 'AWS',                        # required
    :aws_access_key_id      => 'AKIAITHT6OY4OVUHCUZQ',                        # required
    :aws_secret_access_key  => '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',                        # required
  }
  config.fog_directory  = 'while_true'                     # required
end